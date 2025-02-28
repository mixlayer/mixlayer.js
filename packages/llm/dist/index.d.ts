interface OpenOptions {
    tools?: boolean;
}
interface GenOptions {
    role?: string;
    [key: string]: any;
}
interface AppendOptions {
    role?: string;
    hidden?: boolean;
    [key: string]: any;
}
interface Tool {
    name: string;
    description: string;
    fn: (params: any) => Promise<any> | any;
    parameters?: Record<string, any>;
}
interface ToolDefinitions {
    [key: string]: Tool;
}
export declare function open(opts?: OpenOptions): Promise<Seq>;
export declare class Seq {
    readonly id: string | number;
    readonly toolsEnabled: boolean;
    readonly tools: ToolDefinitions;
    constructor(seqId: string | number, opts: OpenOptions, toolDefs?: ToolDefinitions);
    gen(opts?: GenOptions): Promise<any>;
    append(text: string, opts?: AppendOptions): Promise<any>;
    fork(): Promise<Seq>;
    invokeTool(name: string, params: any): Promise<any>;
    install(tool: Tool): Promise<void>;
    close(): Promise<void>;
}
interface ProxyOptions {
    role?: string;
    [key: string]: any;
}
export declare class ProxySeq {
    private genOverrides;
    private appendOverrides;
    private inner;
    constructor(genOverrides: ProxyOptions, appendOverrides: ProxyOptions, inner: Seq);
    gen(opts?: GenOptions): Promise<any>;
    append(text: string, opts?: AppendOptions): Promise<any>;
}
export declare function user(inner: Seq): ProxySeq;
export declare function assistant(inner: Seq): ProxySeq;
export {};
