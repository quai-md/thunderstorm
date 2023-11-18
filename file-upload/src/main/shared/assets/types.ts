import {DB_Object, DBProto, Proto_DB_Object, TS_Object, VersionsDeclaration} from '@nu-art/ts-common';


type Versions = VersionsDeclaration<DB_Asset, ['1.0.1', '1.0.0'], [DB_Asset]>;
type Dependencies = {
//
}

type UniqueKeys = '_id';
type GeneratedKeys =
	'signedUrl' |
	'timestamp' |
	'md5Hash' |
	'path' |
	'bucketName' |
	'public' |
	'metadata'

type Proto = Proto_DB_Object<DB_Asset, GeneratedKeys, Versions, UniqueKeys, Dependencies>;

export type DBProto_Assets = DBProto<Proto>;

export type UI_Asset = DBProto_Assets['uiType'];
export type DB_Asset = DB_Object & {
	key: string
	name: string
	feId: string
	ext: string
	mimeType: string

	timestamp: number
	md5Hash?: string
	path: string
	bucketName: string
	public?: boolean
	metadata?: TS_Object
	signedUrl?: {
		url: string,
		validUntil: number
	}
}
