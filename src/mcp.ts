#!/usr/bin/env node

import { OrderedMap, fromJS, List, Map as ImmutableMap } from 'immutable';
import { SectionContent, SectionNodeMap, McpOperation, IncompleteSectionInfo, GetContextParams, UpdateContextParams} from './mcp-types';
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from "@modelcontextprotocol/sdk/types.js";

// --- 模板定义 ---
// 为了类型安全，我们可以更明确地定义模板的结构，但初始模板通常用JS对象然后用fromJS转换
// 我们将从一个普通的JS对象开始，并使用Immutable.js
const INITIAL_TEMPLATE_JS_OBJECT: SectionNodeMap = {
    "1_overview": {
        title: "1. 概述",
        content: "",
        subsections: {
            "1_1_demand_background": {title: "1.1 需求背景", content: ""},
            "1_2_target": {
                title: "1.2 目标",
                content: "",
                subsections: {
                    "1_2_1_business_target": {title: "1.2.1 需求业务目标", content: ""},
                    "1_2_2_technical_target": {title: "1.2.2 技术目标", content: ""}
                }
            }
        }
    },
    "2_demand_analysis": {
        title: "2. 需求分析",
        content: "",
        subsections: {
            "2_1_demand_scope": {title: "2.1 需求范围", content: ""},
            "2_2_business_use_cases": {title: "2.2 业务用例", content: ""},
            "2_3_business_function_list": {title: "2.3 业务功能列表", content: ""}
        }
    },
    "3_system_analysis_design": {
        title: "3. 系统分析与设计",
        content: "",
        subsections: {
            "3_1_system_dependency_analysis": {title: "3.1 系统依赖分析", content: ""},
            "3_2_critical_function_design": {title: "3.2 关键功能设计", content: ""},
            "3_3_basic_component_config_change": {
                title: "3.3 基础组件配置变更",
                content: "",
                subsections: {
                    "3_3_1_mq_change": {title: "3.3.1 MQ变更", content: ""},
                    "3_3_2_database_change": {title: "3.3.2 数据库变更", content: ""}
                }
            },
            "3_4_offline_data_impact_analysis": {title: "3.4 离线数据影响分析", content: ""}
        }
    },
    "5_technical_risk_analysis": {
        title: "5. 技术风险分析",
        content: "",
        subsections: {
            "5_1_risk_description": {title: "5.1 风险说明", content: ""}
        }
    },
    "6_appendix": {title: "6. 附录（其他文档）", content: ""}
};

// 使用 reviver 确保所有层级都是 OrderedMap
// export const TEMPLATE_STRUCTURE_TS: ImmutableMap<string, any> = fromJS(
//     INITIAL_TEMPLATE_JS_OBJECT, 
//     function (key: string | number, value: any) {
//         if (ImmutableMap.isMap(value)) {
//             return value.toOrderedMap();
//         } else if (List.isList(value)) { 
//             return value; 
//         }
//         return value; 
//     }
// ) as ImmutableMap<string, any>;
export const TEMPLATE_STRUCTURE_TS: ImmutableMap<string, any> = 
    ImmutableMap(INITIAL_TEMPLATE_JS_OBJECT); // 直接用 Immutable.Map() 构造函数


export class TechnicalSolutionServer {
    private context: ImmutableMap<string, any>; // 使用 Immutable.js 的 Map
    private readonly pathSeparator: string = '.';

    constructor(initialTemplate: ImmutableMap<string, any> = TEMPLATE_STRUCTURE_TS) {
        this.context = initialTemplate;
    }

    /**
     * 将字符串路径转换为Immutable.js可用的路径数组。
     * Agent/LLM提供的路径应该是精确的，例如 "1_overview.subsections.1_1_demand_background.content"
     * @param pathStr The string path.
     * @returns Array of keys for Immutable.js getIn/setIn.
     */
    private stringPathToKeyArray(pathStr: string): string[] {
        return pathStr.split(this.pathSeparator);
    }

    /**
     * 校验并解析 getContext 的输入参数。
     * @param paramsInput 输入参数，类型为 unknown。
     * @returns 解析后的 GetContextParams 对象，如果校验失败则抛出错误或返回特定错误对象。
     * @throws Error 如果参数类型不正确。
     */
    private parseGetContextParams(paramsInput: unknown): GetContextParams {
        if (paramsInput === null || paramsInput === undefined) {
            return {sectionPath: null }; // 默认行为
        }

        if (typeof paramsInput !== 'object' || paramsInput === null) {
            throw new Error('[MCP ParseError] getContext: Input params must be an object or null/undefined.');
        }

        const params = paramsInput as Record<string, unknown>; // 类型断言，后续会校验
        const parsed: GetContextParams = { sectionPath: null}; // 设置默认值

        if (params.hasOwnProperty('sectionPath')) {
            if (params.sectionPath === null || typeof params.sectionPath === 'string') {
                parsed.sectionPath = params.sectionPath as string | null;
            } else {
                throw new Error('[MCP ParseError] getContext: "sectionPath" must be a string or null.');
            }
        }
        
        return parsed;
    }

    /**
     * 获取上下文内容。
     * @param sectionPath Path to the desired section or content field.
     *                    If null, returns the entire context as a JS object.
     * @returns The content at the path, or undefined if not found.
     */
    public getContext(paramsInput: unknown): any | undefined {
        let params: GetContextParams = this.parseGetContextParams(paramsInput);

        const { sectionPath } = params;

        if (!sectionPath) {
            return this.context.toJS();
        }
        const pathArray = this.stringPathToKeyArray(sectionPath);
        const data = this.context.getIn(pathArray);

        if (data === undefined || data == null) {
            return undefined;
        }
        // 更安全的检查 toJS 方法的存在和类型
        if (typeof data === 'object' && data !== null && typeof (data as any).toJS === 'function') {
            return (data as any).toJS();
        }    
        return data;
    }

    /**
     * 校验并解析 updateContext 的输入参数。
     * @param paramsInput 输入参数，类型为 unknown。
     * @returns 解析后的 UpdateContextParams 对象。
     * @throws Error 如果参数缺失或类型不正确。
     */
    private parseUpdateContextParams(paramsInput: unknown): UpdateContextParams {
        if (typeof paramsInput !== 'object' || paramsInput === null) {
            throw new Error('[MCP ParseError] updateContext: Input params must be an object.');
        }

        const params = paramsInput as Record<string, unknown>;
        
        if (!params.hasOwnProperty('path') || typeof params.path !== 'string' || params.path.trim() === '') {
            throw new Error('[MCP ParseError] updateContext: "path" is required and must be a non-empty string.');
        }
        
        if (!params.hasOwnProperty('content')) { // content 可以是 null 或其他，但必须存在
            throw new Error('[MCP ParseError] updateContext: "content" is required.');
        }

        const parsedMode = params.hasOwnProperty('mode') ? params.mode : "overwrite";
        if (parsedMode !== "overwrite" && parsedMode !== "append") {
            throw new Error('[MCP ParseError] updateContext: "mode" must be "overwrite" or "append".');
        }

        return {
            path: params.path as string,
            content: params.content as string, // 保留 any 类型
            mode: parsedMode as "overwrite" | "append"
        };
    }

    /**
     * 更新上下文内容。
     * @param path Path to the content field to update.
     * @param content The new content.
     * @param mode Update mode: "overwrite" or "append".
     * @returns True if the context was changed, false otherwise.
     */
    public updateContext(paramsInput: unknown): boolean {
        let params: UpdateContextParams = this.parseUpdateContextParams(paramsInput);

        const { path, content, mode } = params;

        const pathArray = this.stringPathToKeyArray(path);

        // 检查父路径是否存在
        const pathToParent = pathArray.slice(0, -1);
        if (pathToParent.length > 0 && !this.context.hasIn(pathToParent)) {
            console.warn(`[MCP] Update failed: Parent path "${pathToParent.join(this.pathSeparator)}" does not exist for "${path}".`);
            return false;
        }

        let newContext: ImmutableMap<string, any>;
        if (mode === "overwrite") {
            newContext = this.context.setIn(pathArray, content);
        } else if (mode === "append") {
            const currentContent = this.context.getIn(pathArray, ""); // Default to empty string
            if (typeof currentContent !== 'string' || typeof content !== 'string') {
                console.warn(`[MCP] Append mode for path "${path}" requires existing and new content to be strings. Appending as is.`);
                const appendedContent = (currentContent || "") + (content || ""); // 尝试合并
                newContext = this.context.setIn(pathArray, appendedContent);
            } else {
                 newContext = this.context.setIn(pathArray, currentContent + (currentContent ? "\n" : "") + content);
            }
        } else {
            console.warn(`[MCP] Unknown update mode: ${mode}`);
            return false;
        }

        if (newContext !== this.context) {
            this.context = newContext;
            console.log(`[MCP] Context updated for path: "${path}" (mode: ${mode})`);
            return true;
        }
        return false; // No change
    }

    /**
     * 将整个上下文或指定部分转换为字符串，供Agent的LLM使用。
     * @param sectionPathPrefix Optional. If provided, only formats this part of the context.
     * @returns A string representation of the context.
     */
    public getContextAsString(sectionPathPrefix?: string | null): string {
        let rootNodeToFormat: ImmutableMap<string, any> | any = this.context;
        let initialPathPartsForDisplay: string[] = [];

        if (sectionPathPrefix) {
            const pathArray = this.stringPathToKeyArray(sectionPathPrefix);
            if (this.context.hasIn(pathArray)) {
                rootNodeToFormat = this.context.getIn(pathArray);
                initialPathPartsForDisplay = pathArray;
            } else {
                return `[MCP] Path prefix "${sectionPathPrefix}" not found in context.`;
            }
        }
        
        if (!rootNodeToFormat || typeof rootNodeToFormat.get !== 'function') {
             return `[MCP] Node at "${sectionPathPrefix || 'root'}" is not a valid Immutable Map structure. Content: ${JSON.stringify(rootNodeToFormat)}`;
        }


        const outputLines: string[] = [];
        const _recursiveFormat = (
            node: ImmutableMap<string, any> | any, // Can be a Map or a primitive (e.g. content string)
            currentPathKeyParts: string[], // Actual keys used for getIn
            indentLevel: number = 0
        ): void => {
            if (!node || typeof node.get !== 'function') { // Not an Immutable Map, might be content itself
                if (node !== undefined ) { // Handle case where path points directly to content
                     // This case is less likely if we always start formatting from a SectionContent-like node
                }
                return;
            }

            const title: string = node.get("title", "未命名章节") as string;
            const content: string = node.get("content", "") as string;
            const currentPathStr = currentPathKeyParts.join(this.pathSeparator);

            if ((content && content.trim() !== "")) {
                outputLines.push(`${'  '.repeat(indentLevel)}[章节点路径: ${currentPathStr}] ${title}`);
                if (content && content.trim() !== "") {
                    outputLines.push(`${'  '.repeat(indentLevel + 1)}内容: ${content.trim().split('\n').join(`\n${'  '.repeat(indentLevel + 1)}`)}`);
                }             
            }

            const subsections: ImmutableMap<string, any> | undefined = node.get("subsections") as ImmutableMap<string, any> | undefined;
            if (subsections && subsections.size > 0) {
                subsections.forEach((subNode, subKey) => {
                    _recursiveFormat(subNode, [...currentPathKeyParts, "subsections", subKey], indentLevel + 1);
                });
            }
        };
        
        if (sectionPathPrefix) { // Formatting a sub-part
            // Check if rootNodeToFormat itself is a SectionContent like structure
            const title = rootNodeToFormat.get("title");
            if (title !== undefined) { // It's likely a section node
                _recursiveFormat(rootNodeToFormat, initialPathPartsForDisplay, 0);
            } else { // It might be a map of sections (like the root this.context)
                 rootNodeToFormat.forEach((node: ImmutableMap<string, any>, key: string) => {
                    _recursiveFormat(node, [...initialPathPartsForDisplay, key], 0);
                });
            }
        } else { // Formatting the whole document from the root
            this.context.forEach((node, key) => { // node here is a top-level SectionContent
                _recursiveFormat(node, [key], 0);
            });
        }
        return outputLines.join("\n");
    }

    /**
     * 生成最终的文档 (Markdown格式).
     * @returns The Markdown string.
     */
    public generateDocument(): string {
        const mdOutput: string[] = ["# 技术方案文档\n"];
        const _recursiveGenerateMd = (node: ImmutableMap<string, any>, level: number = 1): void => {
            if (!node || typeof node.get !== 'function') return;

            const title: string = node.get("title", "未命名章节") as string;
            const content: string = node.get("content", "") as string;

            mdOutput.push(`${'#'.repeat(Math.min(level, 6))} ${title}\n`);
            
            if (content && content.trim() !== "") {
                mdOutput.push(`${content.trim()}\n`);
            }
            
            const subsections: ImmutableMap<string, any> | undefined = node.get("subsections") as ImmutableMap<string, any> | undefined;
            if (subsections && subsections.size > 0) {
                subsections.forEach((subNode) => {
                    _recursiveGenerateMd(subNode, level + 1);
                });
            }
            mdOutput.push(""); // Add a blank line for spacing
        };

        this.context.forEach((node) => { // node is a top-level SectionContent
            _recursiveGenerateMd(node, 1);
        });
        return mdOutput.join("\n");
    }
}

    /**
     * 将整个上下文或指定部分转换为字符串，供Agent的LLM使用。
     * @param sectionPathPrefix Optional. If provided, only formats this part of the context.
     * @returns A string representation of the context.
     */
const QUERY_TECHNICAL_SOLUTION_CONTEXT: Tool = {
    name: "queryTechnicalSolutionContext",
    description: `
    Tool名称: queryTechnicalSolutionContext (查询技术方案上下文)

    1. Tool概述:
   'queryTechnicalSolutionContext' 工具允许你查询当前正在构建的技术方案文档的结构化上下文。你可以获取整个文档的内容，也可以精确查询特定章节或子章节的详细信息。这个工具是你理解当前文档状态、识别信息缺口、以及决定下一步行动（例如，向用户提问或更新特定章节）的关键。

    2. 何时可以使用这个Tool:
   - **当你完成技术方案(调用完updateTechnicalSolutionContext)之后，你需要调用此工具以便于展示完整的技术方案给用户
   - **在处理用户输入之前或之后：** 为了了解用户提供的信息应该如何融入现有文档结构。
   - **当需要生成引导性问题时：** 查询上下文以发现哪些部分是空的、不完整的或需要进一步阐述的，从而向用户提出有针对性的问题。
   - **在决定更新哪个章节之前：** 确认目标章节的当前内容，以决定是覆盖、追加还是进行更复杂的修改。
   - **当用户要求查看文档的某一部分时：** 获取指定章节的内容以展示给用户。
   - **在生成最终文档之前进行最终检查：** （虽然生成文档有专门的Tool，但查询可以用于局部预览）。
   - **当你需要理解不同章节之间的关联性或一致性时：** 通过查询多个相关章节来辅助判断。

    3. 核心功能:
   - **获取整个文档上下文：** 返回当前技术方案文档所有章节及其内容的结构化表示。
   - **查询特定章节/路径的内容：** 允许你通过一个精确的路径字符串（例如 "1_overview.subsections.1_1_demand_background.content"）来获取特定章节的标题、内容，或者某个具体字段的值。
   - **控制空内容的展示：** 可以选择在查询结果中是否包含那些当前内容为空的章节信息。

    4. 参数解释:
   - **'sectionPath' (可选, 字符串类型):**
     *   描述：你想要查询的文档内部的具体路径。路径由章节的键名通过点（.）连接而成。
     *   如果此参数未提供或为 'null'，则工具将返回整个文档的当前上下文。
     *   结构：
         *   要获取某个章节节点（包含其标题、内容和可能的子章节）的完整信息，路径通常指向该章节的键名，例如 '1_overview' 或 '1_overview.subsections.1_1_demand_background'。
         *   要直接获取某个章节的文本内容，路径应指向该章节下的 'content' 字段，例如 '1_overview.subsections.1_1_demand_background.content'。
         *   要获取某个章节的标题，路径应指向该章节下的 'title' 字段，例如 '1_overview.subsections.1_1_demand_background.title'。
         *   关键的子章节容器键名是 'subsections'。
     *   示例：
         *   "1_overview": 获取整个“概述”章节（包括其所有子章节）。
         *   "2_demand_analysis.subsections.2_1_demand_scope": 获取“需求分析”下的“2.1 需求范围”这个子章节节点。
         *   "2_demand_analysis.subsections.2_1_demand_scope.content": 获取“2.1 需求范围”的具体文本内容。

    **5. 你（LLM）应该怎么做：**
   1.  **明确查询目的：** 在调用此工具前，想清楚你希望通过查询上下文获得什么信息。是为了填充用户输入？是为了找问题问用户？还是为了检查某个特定细节？
   2.  **构造精确的 'sectionPath'：**
       *   参考技术方案的模板结构（你应该已经通过初始指令或之前的交互了解了它）。记住 'subsections' 是连接父子章节的关键。
       *   如果你想获取某个章节的文本内容，确保路径以 '.content' 结尾。
       *   如果你不确定精确路径，可以先查询一个较上层的路径（例如 '1_overview'），从返回结果中分析其子结构，然后再进行更精确的查询。或者，先查询整个文档（不带 'sectionPath' 参数），然后分析输出。
   3.  **分析查询结果：** 工具会返回一个JSON对象（如果查询特定路径且有结果）或者一个结构化的文本字符串（如果查询整个上下文或使用 'getContextAsString' 的场景）。你需要能够解析这个结果。
       *   如果返回的是对象，你可以直接访问其属性（如 'title', 'content', 'subsections'）。
       *   如果返回的是字符串，注意其中可能包含 '[章节点路径: ...]' 和 '内容: ...' 这样的标记，你需要从中提取信息。
   4.  **基于查询结果决策：**
       *   如果发现用户提供的信息与上下文中的某部分相关，你可以准备调用“更新上下文”的Tool。
       *   如果发现关键章节为空或信息不足，你可以构思一个问题，引导用户提供这部分信息。
       *   如果用户的问题是关于文档的某个特定部分，你可以用查询到的内容来回答用户。
   5.  **避免不必要的查询：** 如果你刚刚通过其他方式（例如用户的直接反馈或之前的查询）已经获取了所需信息，就不需要重复查询相同的路径。
   6.  **路径错误处理（预期）：** 如果你提供的 'sectionPath' 不存在，工具可能会返回 'undefined' 或一个空的结果。你需要能够处理这种情况，例如，可以尝试查询一个更通用的上级路径，或者向用户表明无法找到指定信息。

通过有效利用 'queryTechnicalSolutionContext' 工具，你将能够更智能地与用户互动，并逐步构建出高质量的技术方案文档。
    `,
    "inputSchema": {
    "type": "object",
    "properties": {
      "sectionPath": {
        "type": "string",
        "description": "要查询的文档内部的具体路径，例如 '1_overview.subsections.1_1_demand_background.content'。如果省略，则查询整个文档上下文。"
      },
    },
    "required": [] 
  }
};


const UPDATE_TECHNICAL_SOLUTION_CONTEXT: Tool = {
    "name": "updateTechnicalSolutionContext",
    "description": `
    Tool名称: updateTechnicalSolutionContext (更新技术方案上下文)
    更新当前技术方案文档的指定章节内容。你可以用此工具来填充新的信息、修改现有内容或追加补充说明。这是将用户输入或LLM分析结果实际写入文档的关键步骤。,
    "when_to_use": [
      "当LLM分析用户输入后，确定了用户提供的信息对应文档的某个具体章节时。",
      "当用户直接提供了对某个章节的修改或补充内容时。",
      "在LLM进行内部思考或信息综合后，需要将结论或细化设计写入文档的相应部分时。",
      "当需要修正之前写入的错误或不准确信息时。"
    ],
    "key_features": [
      "向文档的指定路径写入新的内容。",
      "支持覆盖（overwrite）现有内容。",
      "支持在现有内容后追加（append）新内容。"
    ],
    "parameters_explained": {
      "path": {
        "type": "string",
        "optional": false,
        "description": "必须提供的参数。指定要更新内容的文档内部路径。路径由章节的键名通过点（'.'）连接而成，并且通常应指向具体章节的 'content' 字段。例如：'1_overview.subsections.1_1_demand_background.content'。",
        "examples": [
          "1_overview.subsections.1_1_demand_background.content",
          "3_system_analysis_design.subsections.3_2_critical_function_design.content"
        ],
        "notes": "确保路径指向的是一个可以接受文本内容的字段，通常是 'content'。父路径必须存在。"
      },
      "content": {
        "type": "string",
        "optional": false,
        "description": "必须提供的参数。要写入或追加到指定路径的文本内容。"
      },
      "mode": {
        "type": "string",
        "optional": true,
        "default": "overwrite",
        "enum": ["overwrite", "append"],
        "description": "指定更新模式。'overwrite' 会完全替换目标路径的原有内容；'append' 会在原有内容（如果是字符串）的末尾追加新内容（通常会添加换行符）。默认为 'overwrite'。"
      }
    },
    "llm_actor":[
      "你是一名经验丰富的资深Java架构师/技术负责人，精通软件设计原则、设计模式、主流Java技术栈（如Spring Boot, Spring Cloud, MyBatis/JPA, Kafka, Redis, MySQL/PostgreSQL等），并擅长编写清晰、详尽、可落地的技术方案。"
    ],
    "how_llm_should_use": [
      "构造精确的 'path' 参数，确保它指向你想要修改的具体章节的 'content' 字段。参考技术方案模板结构，注意 'subsections' 键。",
      "必要时用流程图表示业务流程，流程图用mermaid或者planuml实现",
      "明确提供 'content' 参数，即你希望写入或追加的文本。",
      "根据需求选择 'mode'：",
      "  - 如果是首次填充、完全重写或修正错误，使用 'overwrite' (或不指定 mode，使用默认值)。",
      "  - 如果是在已有信息的基础上补充额外细节或列表项，使用 'append'。",
      "确保 'content' 是经过处理和提炼的，而不是用户的原始、未经组织的输入（除非特定场景需要）。",
      "一次Tool调用通常更新一个路径。如果需要更新多个章节，可以多次调用此Tool，或者让Agent支持批量操作（如果Agent框架允许）。",
      "操作成功后，可以考虑再次调用 'queryDocumentContext' 确认更新已生效（尤其在复杂流程中），或者直接信任操作结果并向用户反馈。",
      "对于需要补充的部分，可以随时向用户提问",
      "[必须做]每次回答完之后，告诉用户可以做什么事情。比如：你可以继续补充细节，或者修改/完善当前的方案，或者告诉我查看当前的完整技术方案",
      "引导用户查看当前完整的技术方案"
    ]`,
    "inputSchema": {
      "type": "object",
      "properties": {
        "path": {
          "type": "string",
          "description": "要更新内容的文档内部路径，必须指向具体章节的 'content' 字段。例如 '1_overview.subsections.1_1_demand_background.content'。"
        },
        "content": {
          "type": "string",
          "description": "要写入或追加的文本内容。"
        },
        "mode": {
          "type": "string",
          "description": "更新模式：'overwrite'（覆盖）或 'append'（追加）。默认为 'overwrite'。",
          "enum": ["overwrite", "append"],
          "default": "overwrite"
        }
      },
      "required": ["path", "content"]
    }
  }


const server = new Server(
    {
      name: "technical-solution-server",
      version: "1.0.0",
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );
  
const solutionServer = new TechnicalSolutionServer();
  
server.setRequestHandler(ListToolsRequestSchema, async () => ({
tools: [QUERY_TECHNICAL_SOLUTION_CONTEXT,UPDATE_TECHNICAL_SOLUTION_CONTEXT],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
    if (request.params.name === "queryTechnicalSolutionContext") {
      let context = solutionServer.getContext(request.params.arguments);
      return {content: [{type: 'text', text: context}]}
    }

    if (request.params.name === "updateTechnicalSolutionContext") {
        let res = solutionServer.updateContext(request.params.arguments);
      return {content: [{type: 'text', text: res}]}
      }
  
    return {
      content: [{
        type: "text",
        text: `Unknown tool: ${request.params.name}`
      }],
      isError: true
    };
});

async function runServer() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error('TechnicalSolution MCP Server running on stdio @Lloyd');
}
  
runServer().catch((error) => {
    console.error("Fatal error running server:", error);
    process.exit(1);
});