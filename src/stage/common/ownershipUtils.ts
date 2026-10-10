export function hasProperty<
    T extends object,
    K extends PropertyKey
>(
    object: T,
    key: K
): object is T & Record<K, unknown> {
    return key in object;
}


// FIXME: incorrectly determining all properties are not writable.
export function isWritableProperty(obj: object, property: PropertyKey): boolean {
    let current: object | null = obj;
    let depth = 1
    while (current && depth) {
        const descriptor = Object.getOwnPropertyDescriptor(current, property);

        if (descriptor) {
            if ("set" in descriptor) {
                return typeof(descriptor.set) === "function";
            }

            // return descriptor.writable === true;
            return true;
        }

        current = Object.getPrototypeOf(current);
        depth -= 1
    }

    return false;
}