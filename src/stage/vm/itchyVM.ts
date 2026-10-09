import { BaseBackdrop, BaseSprite, Workspace } from "./objects";

export interface ExecutionContext {
    sprite?: BaseSprite
    backdrop: BaseBackdrop
};

export interface Runtime {
    isKeyDown(key: string): boolean;
    // broadcast(message: string): EventRun;
    // other VM-facing operations scripts may need
}

type YieldInstruction = 
    | {type: "waitOneFrame"}
    | {type: "wait"; seconds: number}
    | {type: "waitUntil"; condition: () => boolean}
    | {type: "waitingFor"; event: EventRun};


type ThreadGenerator = Generator<YieldInstruction, void, unknown>;

export type Script = (context: ExecutionContext) => ThreadGenerator;

enum EventType {
    KEY_STROKE,
    MESSAGE,
    GREEN_FLAG,
    BACKDROP_CHANGE,
    EXCEED,
    CLONE,
    SPRITE_CLICK
}

type GlobalEventType =
    | EventType.KEY_STROKE
    | EventType.MESSAGE
    | EventType.GREEN_FLAG
    | EventType.BACKDROP_CHANGE
    | EventType.EXCEED;

type InstanceEventType =
    | EventType.CLONE
    | EventType.SPRITE_CLICK;

// These tuples describe the arguments used to select which event scripts run.
// They are never passed to the user script itself.
interface EventArgumentMap {
    [EventType.GREEN_FLAG]: [];
    [EventType.MESSAGE]: [message: string];
    [EventType.KEY_STROKE]: [key: string];
    [EventType.BACKDROP_CHANGE]: [];
    [EventType.EXCEED]: [];
    [EventType.CLONE]: [];
    [EventType.SPRITE_CLICK]: [];
}

type EventArguments<T extends EventType> = EventArgumentMap[T];

interface RegisteredScript {
    script: Script;
    context: ExecutionContext;
}

interface EventRegistration {
    args: readonly unknown[];
    script: RegisteredScript;
}

// Arrays are compared by their contents, not used as Map keys (which would
// compare them by reference).
type EventStore = Map<EventType, EventRegistration[]>;

class EventRun {
    // represents a singular event.
    public threads: Thread[] = [];

    public hookThread(thread: Thread) {
        this.threads.push(thread);
    }

    public kill() {
        this.threads.forEach(thread => {
            thread.kill();
        });
    }

    public isDone() {
        return this.threads.every(
            thread => thread.status === "done"
        );
    }
}


class Thread {
    private generator: ThreadGenerator;

    // private _status: ThreadStatus = "waiting";

    private done = false;
    private yieldInstruction?: YieldInstruction;
    private wakeTime?: number;
    private msPerTick: number;

    public childEvent?: EventRun;

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

    public kill() {
        this.done = true;
        this.yieldInstruction = undefined;
        this.wakeTime = undefined;

        if (this.childEvent) {
            this.childEvent.kill();
        }
    }

    public canStep() {
        if (!this.yieldInstruction) {
            return true;
        }

        switch (this.yieldInstruction.type) {
            case "waitOneFrame":
            case "wait":
                return this.wakeTime !== undefined 
                    && performance.now() >= this.wakeTime;
            case "waitUntil":
                return this.yieldInstruction.condition();
            case "waitingFor":
                return (this.childEvent && this.childEvent.isDone());
        }
    }

    public step() {
        if (this.done) {
            return;
        }

        if (!this.canStep()) {
            return;
        }

        // clear everything if we were able to step.
        this.wakeTime = undefined; // we can keep this defined though...
        this.yieldInstruction = undefined;
        this.childEvent = undefined;

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
            case "waitOneFrame":
                this.wakeTime = performance.now() + this.msPerTick;
                break;
            case "waitUntil":
                break;
            case "waitingFor":
                break;
        }

        return yieldInstruction;
    }
}


function addToMapList<K, T>(map: Map<K, T[]>, item: T, key: K) {
    let items = map.get(key);

    if (!items) {
        items = [];
        map.set(key, items);
    }

    items.push(item);
}


export class ItchyVM {
    public msPerTick: number;
    // private workspace: Workspace;
    private threads: Thread[] = [];

    // private events: Map<EventType, Event> = new Map(); 

    // owned by a CLONE not a regular sprite.
    // private ownedThreads: Map<string, Thread[]> = new Map(); 

    // private messageEvents: Map<string, ScriptEvent[]> = new Map();
    // private cloneEvents: Map<string, ScriptEvent[]> = new Map();

    // private events: Map
    private events: EventStore = new Map();

    private keysDown: Set<string> = new Set();

    constructor(tickrate: number) {
        // this.workspace = workspace;
        this.msPerTick = (1 / tickrate) * 1000; 

        window.addEventListener("keydown", event => {
            this.keysDown.add(event.code);
            this.fireGlobalEvent(EventType.KEY_STROKE, event.code);
        });

        window.addEventListener("keyup", event => {
            this.keysDown.delete(event.code);
        });
    }

    public registerEvent<T extends EventType>(
        eventType: T,
        args: EventArguments<T>,
        script: RegisteredScript
    ) {
        // Copy so later changes to the caller's array cannot affect registration.
        addToMapList(this.events, {args: [...args], script}, eventType);
    }

    private matchesEventArguments(
        eventType: EventType,
        registeredArgs: readonly unknown[],
        firedArgs: readonly unknown[]
    ): boolean {
        // Handle event-specific matching rules (e.g. thresholds or wildcards)
        // here, without passing arguments to user scripts.
        switch (eventType) {
            default:
                // By default, all arguments must match, in order.
                return registeredArgs.length === firedArgs.length &&
                    registeredArgs.every((arg, index) => Object.is(arg, firedArgs[index]));
        }
    }

    private getMatchingScripts<T extends EventType>(
        eventType: T,
        args: EventArguments<T>
    ): RegisteredScript[] {
        const registrations = this.events.get(eventType) ?? [];
        return registrations
            .filter(registration =>
                this.matchesEventArguments(eventType, registration.args, args)
            )
            .map(registration => registration.script);
    }

    public fireInstanceEvent<T extends InstanceEventType>(
        eventType: T,
        instance: BaseSprite,
        ...args: EventArguments<T>
    ) {
        const eventRun = new EventRun();

        for (const script of this.getMatchingScripts(eventType, args)) {
            const registeredSprite = script.context.sprite;

            if (!registeredSprite) {
                continue;
            }

            // This script belongs to a different sprite definition.
            if (registeredSprite.name !== instance.name) {
                continue;
            }

            const context: ExecutionContext = {
                ...script.context,
                sprite: instance
            };

            const thread = this.spawnScript(script, context);
            eventRun.hookThread(thread);
        }

        return eventRun;
    }

    public fireGlobalEvent<T extends GlobalEventType>(
        eventType: T,
        ...args: EventArguments<T>
    ) {
        const eventRun = new EventRun();

        for (const script of this.getMatchingScripts(eventType, args)) {
            const thread = this.spawnScript(script);
            eventRun.hookThread(thread);
        }

        return eventRun;
    }

    private spawnScript(script: RegisteredScript, context: ExecutionContext = script.context) {
        const thread = new Thread(
            script.script(context),
            this.msPerTick
        );

        this.threads.push(thread);

        return thread;
    }

    public stop() {
        this.threads.forEach(thread => {
            thread.kill(); 
        });
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

            if (thread.childEvent) {
                const threadsFinished = thread.childEvent.isDone();

                if (!threadsFinished) {
                    continue;
                }

                thread.childEvent = undefined;
            }

            const yieldReason = thread.step();

            if (!yieldReason) {
                continue;
            }

            requests.push({
                thread,
                yieldReason
            });
        }

        for (const {thread, yieldReason} of requests) {
            switch (yieldReason.type) {
                case "waitingFor":
                    thread.childEvent = yieldReason.event;
            }
        }

        this.threads = this.threads.filter(
            thread => thread.status !== "done"
        );
    }
}
