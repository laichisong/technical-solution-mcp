"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// Example: mcp.test.ts (using Jest or a similar framework)
const mcp_1 = require("./mcp");
const mcp_2 = require("./mcp"); // 假设模板也导出或可构造
describe('TechnicalSolutionServer Core Logic', () => {
    let mcpServerInstance;
    beforeEach(() => {
        mcpServerInstance = new mcp_1.TechnicalSolutionServer(mcp_2.TEMPLATE_STRUCTURE_TS); // 使用干净的模板实例
    });
    // it('should get the whole context when sectionPath is null', () => {
    //     const context = mcpServerInstance.getContext({ sectionPath: null });
    //     expect(context).toBeDefined();
    //     expect(context['1_overview']).toBeDefined();
    // });
    // it('should get specific content', () => {
    //     const path = "1_overview.subsections.1_1_demand_background.content";
    //     mcpServerInstance.updateContext({ path, content: "Test background" });
    //     const content = mcpServerInstance.getContext({ sectionPath: path });
    //     expect(content).toEqual("Test background");
    // });
    it('should update context in overwrite mode', () => {
        const path = "1_overview.content";
        mcpServerInstance.updateContext({ path, content: "Initial content" });
        mcpServerInstance.updateContext({ path, content: "Overwritten content", mode: "overwrite" });
        const content = mcpServerInstance.getContext({ sectionPath: path });
        expect(content).toEqual("Overwritten content");
    });
    // ... 更多测试用例 for updateContext, getContextAsString, etc. ...
});
