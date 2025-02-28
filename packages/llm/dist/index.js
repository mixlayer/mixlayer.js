"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProxySeq = exports.Seq = void 0;
exports.open = open;
exports.user = user;
exports.assistant = assistant;
function open(opts) {
    return __awaiter(this, void 0, void 0, function* () {
        const open_opts = opts || {};
        let new_seq_id = yield _model_open_seq(open_opts);
        return new Seq(new_seq_id, open_opts);
    });
}
class Seq {
    constructor(seqId, opts, toolDefs) {
        this.id = seqId;
        this.toolsEnabled = opts.tools || false;
        this.tools = toolDefs || {};
    }
    gen(opts) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield _model_seq_gen(this, opts || {});
        });
    }
    append(text, opts) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield _model_seq_append(this.id, text, opts || {});
        });
    }
    fork() {
        return __awaiter(this, void 0, void 0, function* () {
            let new_seq_id = yield _model_seq_fork(this);
            return new Seq(new_seq_id, { tools: this.toolsEnabled }, this.tools);
        });
    }
    invokeTool(name, params) {
        return __awaiter(this, void 0, void 0, function* () {
            let tool = this.tools[name];
            if (!tool) {
                throw new Error(`Tool ${name} not found`);
            }
            return yield Promise.resolve(tool.fn(params));
        });
    }
    install(tool) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.toolsEnabled) {
                throw new Error("Tools are not enabled for this seq, call `open` with `{ tools: true }`");
            }
            if (!tool.name) {
                throw new Error("Tool must have a name");
            }
            if (typeof tool.name !== "string") {
                throw new Error("Tool name must be a string");
            }
            if (!tool.name.match(/^[a-zA-Z0-9_]+$/)) {
                throw new Error(`Tool name ${tool.name} is not valid, only alphanumeric and underscores allowed.`);
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
            yield this.append(`Use the function '${tool.name}' to: ${tool.description}\n` +
                JSON.stringify({
                    name: tool.name,
                    description: tool.description,
                    parameters: tool.parameters,
                }, null, 2) +
                "\n\n", { role: "system", hidden: true });
            this.tools[tool.name] = tool;
        });
    }
    close() {
        return __awaiter(this, void 0, void 0, function* () {
            throw new Error("not implemented");
        });
    }
}
exports.Seq = Seq;
class ProxySeq {
    constructor(genOverrides, appendOverrides, inner) {
        this.genOverrides = genOverrides;
        this.appendOverrides = appendOverrides;
        this.inner = inner;
    }
    gen(opts) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.inner.gen(Object.assign(Object.assign({}, this.genOverrides), opts));
        });
    }
    append(text, opts) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.inner.append(text, Object.assign(Object.assign({}, this.appendOverrides), opts));
        });
    }
}
exports.ProxySeq = ProxySeq;
function user(inner) {
    return new ProxySeq({ role: "user" }, { role: "user" }, inner);
}
function assistant(inner) {
    return new ProxySeq({ role: "assistant" }, { role: "assistant" }, inner);
}
