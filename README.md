# 技术方案生成MCP

这是一个基于Model Context Protocol (MCP) 的技术方案生成服务器，用于帮助生成和管理技术方案文档。

## Features

1. **结构化文档管理**
   - 支持创建和维护结构化的技术方案文档
   - 提供模板化的章节结构
   - 支持子章节的嵌套管理

2. **智能内容更新**
   - 提供查询上下文工具（queryTechnicalSolutionContext）
   - 提供更新上下文工具（updateTechnicalSolutionContext）
   - 支持内容的覆盖和追加模式

3. **模板结构**
   - 概述（需求背景、目标等）
   - 需求分析（需求范围、业务用例等）
   - 系统分析与设计（系统依赖、关键功能设计等）

## Quick Start 

1. Installation
```bash
npm install
```

2. CLI
```bash
npm run build
node ./build/mcp.js
```

3. MCP sever configuration
```bash
{
    "mcpServers": {
        "technical-solution": {
            "command": "npx",
            "args": [
                "-y",
                "technical-solution"
            ]
        }
    }
}
```

## 使用说明

### 查询上下文
使用 `queryTechnicalSolutionContext` 工具查询文档的特定章节或整体内容。

### 更新上下文
使用 `updateTechnicalSolutionContext` 工具更新文档内容，支持覆盖和追加模式。

## 项目结构

```
src/
├── mcp.ts              # 主服务器实现
├── mcp-types.ts       # 类型定义
└── index.ts           # 入口文件
```

## 许可证

ISC License
