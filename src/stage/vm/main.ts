import { BaseSprite, Backdrop } from "./objects"


type YieldInstruction = 
    | {type: "yield"}
    | {type: "wait"; seconds: number}
    | {type: "waitUntil"; condition: () => boolean}
    | {type: "broadcastAndWait"; name: string}


type ThreadGenerator = Generator<YieldInstruction, void, unknown>;
export type Script = () => ThreadGenerator;


class Thread {
    private generator: ThreadGenerator;

    // private _status: ThreadStatus = "waiting";

    private done = false;
    private yieldInstruction?: YieldInstruction;
    private wakeTime?: number;
    private msPerTick: number;

    public childThreads: Thread[] = [];

    public get status() {
        if (this.done) {
            return "done";
        }

        if (this.yieldInstruction) {
            return "waiting";
        }

        return "running";
    }

    constructor(generator: ThreadGenerator, msPerTick: number) {
        this.generator = generator;
        this.msPerTick = msPerTick;
    }

    public canStep() {{
        if (!this.yieldInstruction) {
            return true;
        }

        switch (this.yieldInstruction.type) {
            case "yield":
            case "wait":
                return this.wakeTime !== undefined 
                    && performance.now() >= this.wakeTime;
            case "waitUntil":
                return this.yieldInstruction.condition();
            case "broadcastAndWait":
                return this.childThreads.every(
                    thread => thread.status === "done"
                )
        }
    }}

    public step() {
        if (!this.canStep()) {
            return;
        }

        // clear everything if we were able to step.
        this.wakeTime = undefined; // we can keep this defined though...
        this.yieldInstruction = undefined;
        this.childThreads = [];

        const result = this.generator.next();

        if (result.done) {
            this.done = true;
            return;
        }

        const yieldInstruction = result.value;

        this.yieldInstruction = yieldInstruction;

        switch (yieldInstruction.type) {
            case "wait":
                this.wakeTime = performance.now() + yieldInstruction.seconds * 1000;
                break;
            case "yield":
                this.wakeTime = performance.now() + this.msPerTick;
                break;
            case "waitUntil":
                break;
            case "broadcastAndWait":
                // the VM fills this in for us here.
                break;
        }

        return yieldInstruction;
    }
}


export class ItchyVM {
    public msPerTick: number;
    private threads: Thread[] = [];
    private blockables: Map<string, Script[]> = new Map();

    constructor(tickrate: number) {
        this.msPerTick = (1 / tickrate) * 1000; 
    }

    public spawnThread(script: Script) {
        const thread = new Thread(
            script(),
            this.msPerTick
        );

        this.threads.push(thread);

        return thread;
    }

    private spawnBlockable(name: string) {
        const scripts = this.blockables.get(name);

        return scripts!.map(script =>
            this.spawnThread(script)
        );
    }

    public registerBlockable(name: string, script: Script) {
        // broadcasts are considered 'blockable' as their execution
        // will halt other threads that have 'broadcastAndWait`
        let scripts = this.blockables.get(name);

        if (!scripts) {
            scripts = [];
            this.blockables.set(name, scripts)
        }

        scripts.push(script);
    }

    public step() {
        // create a copy of threads at the time of this step; 
        // we may spawn new ones of which we'd iterate over
        const existingThreads = [...this.threads];
         
        /*
        We run this in two phases:

        phase 1: 

        run all the threads we can see. if they yield for any reason, we
        collect them and see what we can do with them.

        phase 2: 
        process the yielded threads. 

        we do two phases because we might not catch defined broadcasts on the
        first phase, which is required to handle broadcastAndWait.

        we're guaranteed to gather all broadcast events from the first sweep. 
        that's why only 2 phases are required rather than 2<.
        */
        const requests = [];

        for (const thread of existingThreads) {
            if (thread.status === "done") {
                continue;
            }

            if (thread.childThreads.length > 0) {
                const threadsFinished = thread.childThreads.every(
                    child => child.status === "done"
                );

                if (!threadsFinished) {
                    continue;
                }

                thread.childThreads = [];
            }

            const yieldReason = thread.step();

            if (!yieldReason) {
                continue;
            }

            requests.push({
                thread,
                yieldReason
            })
        }

        for (const {thread, yieldReason} of requests) {
            switch (yieldReason.type) {
                case "broadcastAndWait":
                    thread.childThreads = this.spawnBlockable(yieldReason.name);
            }
        }

        this.threads = this.threads.filter(
            thread => thread.status !== "done"
        );
    }
}
