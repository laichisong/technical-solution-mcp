#!/usr/bin/env node

// 使用 string literal types 来约束章节的键，如果可能的话，但这会使模板非常冗长
// 更实用的方式是使用 string，并依赖运行时校验或LLM的正确输出
// export type SectionKey = "1_overview" | "1_1_demand_background" | ... ;

export interface SectionContent {
    title: string;
    content: string;
    subsections?: SectionNodeMap; // 子章节是可选的
}

export interface SectionNodeMap {
    [key: string]: SectionContent;
}

export interface McpOperation {
    path: string;       // e.g., "1_overview.subsections.1_1_demand_background.content"
    content: any;       // 内容可以是字符串，或者对于某些特殊字段是其他类型
    mode?: "overwrite" | "append"; // 默认为 overwrite
}

export interface IncompleteSectionInfo {
    path: string;       // 指向需要补充的 content 字段的路径
    title: string;
    reason: string;
}

export interface GetContextParams {
    sectionPath?: string | null;
}

export interface UpdateContextParams {
    path: string;
    content: any; // 通常是 string，但保持 any 以允许未来扩展
    mode?: "overwrite" | "append";
}