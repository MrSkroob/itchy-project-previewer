export function hasProperty<
    T extends object,
    K extends PropertyKey
>(
    object: T,
    key: K
): object is T & Record<K, unknown> {
    return key in object;
}