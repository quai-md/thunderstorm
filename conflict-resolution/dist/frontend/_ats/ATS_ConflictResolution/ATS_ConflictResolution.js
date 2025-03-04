"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var _a;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ATS_ConflictResolution = void 0;
const React = __importStar(require("react"));
const ts_common_1 = require("@nu-art/ts-common");
require("./ATS_ConflictResolution.scss");
const frontend_1 = require("@nu-art/thunderstorm/frontend");
const ModuleFE_CollectionActions_1 = require("@nu-art/thunderstorm/frontend/modules/ModuleFE_CollectionActions");
class ATS_ConflictResolution extends frontend_1.ComponentSync {
    constructor() {
        super(...arguments);
        this.getAdapter = () => {
            return (0, frontend_1.SimpleListAdapter)(this.state.upgradableModules, module => React.createElement(React.Fragment, null, module.item.dbDef.dbKey));
        };
        this.checkUsage = async () => {
            var _b;
            const itemId = this.state.itemId;
            const dbKey = (_b = this.state.selectedModule) === null || _b === void 0 ? void 0 : _b.dbDef.dbKey;
            if (!itemId || !dbKey)
                return;
            const response = await ModuleFE_CollectionActions_1.ModuleFE_CollectionActions.check.usage({
                dbKey: dbKey,
                itemIds: [itemId]
            }).setTimeout(2 * ts_common_1.Minute).executeSync();
            this.logWarning(response);
        };
    }
    deriveStateFromProps(nextProps, state) {
        var _b;
        (_b = state.upgradableModules) !== null && _b !== void 0 ? _b : (state.upgradableModules = (0, ts_common_1.sortArray)((0, ts_common_1.filterDuplicates)((0, ts_common_1.RuntimeModules)().filter((module) => {
            return !!module.getCollectionName;
        }), (module) => module.getCollectionName()), item => item.getCollectionName()));
        return state;
    }
    render() {
        const adapter = this.getAdapter();
        return React.createElement(frontend_1.LL_V_L, { id: 'page__check-usage' },
            React.createElement(frontend_1.TS_PropRenderer.Vertical, { label: 'Collection' },
                React.createElement(frontend_1.TS_DropDown, { adapter: adapter, selected: this.state.selectedModule, onSelected: module => this.setState({ selectedModule: module }) })),
            React.createElement(frontend_1.TS_PropRenderer.Vertical, { label: 'Item ID' },
                React.createElement(frontend_1.TS_Input, { type: 'text', value: this.state.itemId, onChange: val => this.setState({ itemId: val }) })),
            React.createElement(frontend_1.Button, { key: 'upgrade-all-test', onClick: this.checkUsage }, "Check Usage"));
    }
}
_a = ATS_ConflictResolution;
ATS_ConflictResolution.screen = {
    name: 'Conflict Resolution',
    key: 'conflict-resolution',
    renderer: _a,
    group: frontend_1.ATS_Backend,
};
exports.ATS_ConflictResolution = ATS_ConflictResolution;
//# sourceMappingURL=ATS_ConflictResolution.js.map