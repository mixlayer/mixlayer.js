interface OpenOptions {
  tools?: boolean;
  systemPrompt?: string;
  toolPrompt?: string;
  skipPrelude?: boolean;
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

// TODO: this tool prompt will vary based on the model, so should be
// passed in as part of an initialiation step
const TOOL_PROMPT =
  '\n# Tool Instructions\nYou may optionally call functions that you have been given access to. You DO NOT have \nto call a function if you do not require it. ONLY call functions if you need them. Do NOT call\nfunctions that you have not been given access to.\n\nIf a you choose to call a function ONLY reply in the following format:\n<{start_tag}={function_name}>{parameters}{end_tag}\nwhere\n\nstart_tag => `<function`\nparameters => a JSON dict with the function argument name as key and function argument value as value.\nend_tag => `</function>`\n\nHere is an example,\n<function=example_function_name>{"example_name": "example_value"}</function>\n\nReminder:\n- Function calls MUST follow the specified format\n- Required parameters MUST be specified\n- You MUST only call functions you have been given access to.\n- Only call one function at a time\n- Put the entire function call reply on one line\n\n';

function preludePrompt(toolsEnabled: boolean) {
  const today = new Date();
  const formattedDate = today.toLocaleDateString("en-US", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const envPrompt = toolsEnabled ? "Environment: ipython\n" : "";
  return `${envPrompt}Cutting Knowledge Date: December 2023\nToday Date: ${formattedDate}\n\n`;
}

export async function open(opts?: OpenOptions): Promise<Seq> {
  const open_opts = opts || {};
  const new_seq_id = await _model_open_seq(open_opts);
  const seq = new Seq(new_seq_id, open_opts);

  const prelude = !open_opts.skipPrelude ? preludePrompt(seq.toolsEnabled) : "";
  const toolPrompt = seq.toolsEnabled
    ? open_opts.toolPrompt ?? TOOL_PROMPT
    : "";
  const systemPrompt = prelude + toolPrompt + (open_opts.systemPrompt ?? "");

  if (systemPrompt.length > 0) {
    await seq.append(systemPrompt, { role: "system", hidden: true });
  }

  return seq;
}

export class Seq {
  readonly id: string | number;
  readonly toolsEnabled: boolean;
  readonly tools: ToolDefinitions;

  constructor(
    seqId: string | number,
    opts: OpenOptions,
    toolDefs?: ToolDefinitions
  ) {
    this.id = seqId;
    this.toolsEnabled = opts.tools || false;
    this.tools = toolDefs || {};
  }

  async gen(opts?: GenOptions): Promise<any> {
    return await _model_seq_gen(this, opts || {});
  }

  async append(
    textOrTokens: number[] | string,
    opts?: AppendOptions
  ): Promise<any> {
    return await _model_seq_append(this, textOrTokens, opts || {});
  }

  async fork(): Promise<Seq> {
    let new_seq_id = await _model_seq_fork(this);
    return new Seq(new_seq_id, { tools: this.toolsEnabled }, this.tools);
  }

  async invokeTool(name: string, params: any): Promise<any> {
    let tool = this.tools[name];

    if (!tool) {
      throw new Error(`Tool ${name} not found`);
    }

    return await Promise.resolve(tool.fn(params));
  }

  async install(tool: Tool): Promise<void> {
    if (!this.toolsEnabled) {
      throw new Error(
        "Tools are not enabled for this seq, call `open` with `{ tools: true }`"
      );
    }

    if (!tool.name) {
      throw new Error("Tool must have a name");
    }

    if (typeof tool.name !== "string") {
      throw new Error("Tool name must be a string");
    }

    if (!tool.name.match(/^[a-zA-Z0-9_]+$/)) {
      throw new Error(
        `Tool name ${tool.name} is not valid, only alphanumeric and underscores allowed.`
      );
    }

    if (!tool.description) {
      throw new Error("Tool must have a description");
    }

    if (this.tools[tool.name]) {
      throw new Error(`Tool with name ${tool.name} already exists`);
    }

    if (typeof tool.description !== "string") {
      throw new Error("Tool description must be a string");
    }

    if (!tool.fn) {
      throw new Error("Tool must have a function (fn)");
    }

    if (typeof tool.fn !== "function") {
      throw new Error("Tool.fn must be a function");
    }

    if (tool.parameters && typeof tool.parameters !== "object") {
      throw new Error("Tool.parameters must be an object");
    }

    await this.append(
      `Use the function '${tool.name}' to: ${tool.description}\n` +
        JSON.stringify(
          {
            name: tool.name,
            description: tool.description,
            parameters: tool.parameters,
          },
          null,
          2
        ) +
        "\n\n",
      { role: "system", hidden: true }
    );

    this.tools[tool.name] = tool;
  }

  async close(): Promise<void> {
    return await _model_seq_close(this);
  }
}

interface ProxyOptions {
  role?: string;
  [key: string]: any;
}

export class ProxySeq {
  private genOverrides: ProxyOptions;
  private appendOverrides: ProxyOptions;
  private inner: Seq;

  constructor(
    genOverrides: ProxyOptions,
    appendOverrides: ProxyOptions,
    inner: Seq
  ) {
    this.genOverrides = genOverrides;
    this.appendOverrides = appendOverrides;
    this.inner = inner;
  }

  async gen(opts?: GenOptions): Promise<any> {
    return await this.inner.gen({
      ...this.genOverrides,
      ...opts,
    });
  }

  async append(text: string, opts?: AppendOptions): Promise<any> {
    return await this.inner.append(text, {
      ...this.appendOverrides,
      ...opts,
    });
  }

  async close(): Promise<void> {
    return await this.inner.close();
  }
}

export function user(inner: Seq): ProxySeq {
  return new ProxySeq({ role: "user" }, { role: "user" }, inner);
}

export function assistant(inner: Seq): ProxySeq {
  return new ProxySeq({ role: "assistant" }, { role: "assistant" }, inner);
}

// platform native functions
declare function _model_open_seq(opts: OpenOptions): Promise<string | number>;
declare function _model_seq_gen(seq: Seq, opts: GenOptions): Promise<any>;
declare function _model_seq_append(
  seqId: Seq,
  textOrTokens: number[] | string,
  opts: AppendOptions
): Promise<any>;
declare function _model_seq_fork(seq: Seq): Promise<string | number>;
declare function _model_seq_close(seq: Seq): Promise<void>;
