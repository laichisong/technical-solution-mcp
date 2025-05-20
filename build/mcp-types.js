#!/usr/bin/env node
"use strict";
// 使用 string literal types 来约束章节的键，如果可能的话，但这会使模板非常冗长
// 更实用的方式是使用 string，并依赖运行时校验或LLM的正确输出
// export type SectionKey = "1_overview" | "1_1_demand_background" | ... ;
Object.defineProperty(exports, "__esModule", { value: true });
