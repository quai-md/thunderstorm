import {AssertionException, ResolvableContent, resolveContent, RuntimeModules} from '@nu-art/ts-common';
import {ModuleFE_BaseDB} from '../../modules/db-api-gen/ModuleFE_BaseDB.js';
import {DataStatus} from '../../core/db-api-gen/consts.js';

type Func = <F extends (...args: any[]) => any>(modules: ResolvableContent<ModuleFE_BaseDB<any, any>[]>, callback: F, fallback?: F) => F;
type ModulesAreReady = (modules: ModuleFE_BaseDB<any, any>[]) => boolean;
type AssertRuntimeModules = (modules: ModuleFE_BaseDB<any, any>[]) => void;
type Return = Func & { modulesAreReady: ModulesAreReady; assertRuntimeModules: AssertRuntimeModules };

const modulesAreReady: ModulesAreReady = (modules) => {
	return modules.every(module => module.getDataStatus() === DataStatus.ContainsData);
};

const assertRuntimeModules: AssertRuntimeModules = (modules) => {
	const runtimeModules = RuntimeModules();
	for (const module of modules) {
		if (!runtimeModules.includes(module))
			throw new AssertionException(`Got module ${module.getName()} that is not in RuntimeModules!`);
		if (!module.dbDef)
			throw new AssertionException(`Got module ${module.getName()} that doesn't have a dbDef!`);
	}
};

const func = <F extends (...args: any[]) => any>(modules: ResolvableContent<ModuleFE_BaseDB<any, any>[]>, callback: F, fallback?: F): F => {
	modules = resolveContent(modules);
	assertRuntimeModules(modules);
	return ((...args: Parameters<F>) => {
		if (!modulesAreReady(modules))
			return fallback?.(...args);

		return callback(...args);
	}) as F;
};

export const AwaitModulesFunction: Return = Object.assign(func, {modulesAreReady, assertRuntimeModules});