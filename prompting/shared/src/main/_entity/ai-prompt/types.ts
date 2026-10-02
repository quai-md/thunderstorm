import {DB_Object, DBProto, Proto_DB_Object, VersionsDeclaration} from '@nu-art/ts-common';
import {AIPromptType} from './consts.js';

type VersionTypes_AIPrompt = {'1.0.0': DB_AIPrompt}
type Versions = VersionsDeclaration<['1.0.0'], VersionTypes_AIPrompt>;
type Dependencies = {}
type UniqueKeys = '_id';
type GeneratedProps = never
type DBKey = 'ai-prompt'
type Proto = Proto_DB_Object<DB_AIPrompt, DBKey, GeneratedProps, Versions, UniqueKeys, Dependencies>;

export type DBProto_AIPrompt = DBProto<Proto>;
export type UI_AIPrompt = DBProto_AIPrompt['uiType'];

export type DB_AIPrompt = DB_Object & {
	label: string
	content: string
	type: AIPromptType
}
