import {signal, suspend} from "./observable";
import {suspendedAsynx} from "./asynx";

export function createResource<T, U = undefined>(
    fetcher: (input: U) => Promise<T>,
    options?: { initialValue?: T }
) {
    const [data, setData] = signal<T | undefined>(options?.initialValue);
    const [error, setError] = signal<Error | null>(null);
    const [loading, setLoading] = signal(false);

    const load = async (input?: U) => {
        try {
            setLoading(true);
            const result = await fetcher(input as U);
            setData(result);
            setError(null);
            return result;
        } catch (err) {
            setError(err instanceof Error ? err : new Error(String(err)));
            throw err;
        } finally {
            setLoading(false);
        }
    };
    const suspendingLoad = (input?: U) => {
        if (loading()) {
            // If already loading, suspend with AsynX batched updates
            return suspend(fetcher(input as U));
        }
        return load(input);
    };

    return {
        data,
        error,
        loading,
        load: suspendingLoad,
    };
}

export function asynxResource<T, U = undefined>(
    fetcher: (input: U) => Promise<T>,
    options?: { initialValue?: T }
) {
    const [data, setData] = signal<T | undefined>(options?.initialValue);
    const [error, setError] = signal<Error | null>(null);
    const [loading, setLoading] = signal(false);

    const load = (input?: U) => {
        if (!loading()) {
            setLoading(true);
        }

        return suspendedAsynx(() => fetcher(input as U), [(value?: T) => {
            setData(value);
            setError(null);
        }, () => setLoading(false)]);
    };

    return {
        data,
        error,
        loading,
        load,
    };
}