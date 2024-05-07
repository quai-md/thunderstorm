import {RuntimePackage, RuntimePackage_WithOutput} from '../core/types';
import {
	__stringify,
	BadImplementationException,
	BeLogged,
	filterDuplicates,
	flatArray,
	ImplementationMissingException,
	lastElement,
	LogClient_Terminal,
	Logger,
	LogLevel,
	sleep
} from '@nu-art/ts-common';
import {RuntimeParams} from '../core/params/params';
import {convertToFullPath} from '@nu-art/commando/core/tools';
import {mapProjectPackages} from './map-project-packages';
import {MemKey_Packages} from '../core/consts';
import * as fs from 'fs';
import {Default_Files, MemKey_DefaultFiles, MemKey_RunningStatus} from '../defaults';
import {MemStorage} from '@nu-art/ts-common/mem-storage/MemStorage';


export const PackageBuildPhaseType_Package = 'package' as const;
export const PackageBuildPhaseType_PackageWithOutput = 'package-with-output' as const;
export const PackageBuildPhaseType_Project = 'project' as const;

type BuildPhase_Base = {
	name: string,
	terminatingPhase?: boolean
	mandatoryPhases?: BuildPhase[]
}
type BuildPhase_Package = BuildPhase_Base & {
	type: typeof PackageBuildPhaseType_Package;
	action: (pkg: RuntimePackage) => Promise<any>;
	filter?: (pkg: RuntimePackage) => Promise<boolean>
}

type BuildPhase_PackageWithOutput = BuildPhase_Base & {
	type: typeof PackageBuildPhaseType_PackageWithOutput;
	action: (pkg: RuntimePackage_WithOutput) => Promise<any>;
	filter?: (pkg: RuntimePackage_WithOutput) => Promise<boolean>
}

type BuildPhase_Project = BuildPhase_Base & {
	type: 'project';
	action: () => Promise<any>;
	filter?: () => Promise<boolean>
}

export type BuildPhase = BuildPhase_Package | BuildPhase_PackageWithOutput | BuildPhase_Project
const mapToName = (item: { name: string }) => item.name;

function resolveAllMandatoryPhases(phase: BuildPhase): BuildPhase[] {
	let result: BuildPhase[] = [phase];
	if (phase.mandatoryPhases) {
		for (const childPhase of phase.mandatoryPhases) {
			result = result.concat(resolveAllMandatoryPhases(childPhase));
		}
	}
	return filterDuplicates(result, result => result.name);
}

export class ProjectManager
	extends Logger {

	private phases: BuildPhase[] = [];
	private dryRun = RuntimeParams.dryRun;
	private terminate = false;

	constructor() {
		super();
		BeLogged.addClient(LogClient_Terminal);
		this.setMinLevel(LogLevel.Verbose);
	}

	private async init() {
		MemKey_DefaultFiles.set(Default_Files);
		process.on('exit', () => {

			MemKey_RunningStatus.get()
			//SAVE
			// fs.write zevel
			process.exit(0);
		});
		this.loadPackage();
	}

	private loadPackage() {
		const pathToConfig = convertToFullPath('./.config/project-config.ts');
		if (!fs.existsSync(pathToConfig))
			throw new ImplementationMissingException(`Missing ./.config/project-config.ts file, could not find in path: ${pathToConfig}`);

		const projectConfig = require(pathToConfig).default;

		const packages = mapProjectPackages(projectConfig);
		MemKey_Packages.set(packages);
	}

	registerPhase(phase: BuildPhase) {
		this.phases.push(phase);
	}

	async prepare(phases = this.phases, index: number = 0) {
		const phasesToRun: BuildPhase[] = [];
		let i = index;
		for (; i < phases.length; i++) {
			const phase = phases[i];
			const isNotSamePackageType = phasesToRun[0] && phase.type !== phasesToRun[0].type;
			const isNextPhaseANoneValidProjectPackage = phase.type === 'project' && (phase.filter && !(await phase.filter()));
			if (isNotSamePackageType) {
				if (isNextPhaseANoneValidProjectPackage)
					continue;
				else
					break;
			}

			if (phase.type !== 'project' || (!phase.filter || await phase.filter?.()))
				phasesToRun.push(phase);

			if (phasesToRun.length > 0 && phase.terminatingPhase) {
				i++;
				break;
			}
		}

		if (!phasesToRun.length)
			return;

		const nextAction = await this.prepare(phases, i);
		this.logDebug('Scheduling phases: ', phasesToRun.map(mapToName));

		if (phasesToRun[0].type === 'project')
			return async () => {
				if (this.terminate)
					return this.logInfo(`Skipping project phases:`, phasesToRun.map(mapToName));

				let didRun = false;
				for (const phase of phasesToRun) {
					this.logInfo(`Running project phase: ${phase.name}`);
					if (this.dryRun) {
						await sleep(1000);
					} else
						await (phase as BuildPhase_Project).action();

					didRun = true;
				}

				if (didRun && lastElement(phasesToRun)!.terminatingPhase)
					this.terminate = true;

				await nextAction?.();
			};

		return async () => {
			let didRun = false;
			let didPrintPhase = false;

			const toRunPackages = MemKey_Packages.get().packagesDependency.map(packages => {
				return async () => {
					let didPrintPackages = false;
					const values = flatArray(packages.map(async pkg => {
						for (const phase of phasesToRun as BuildPhase_Package[]) {
							if (!(!phase.filter || await phase.filter(pkg)))
								continue;

							if (!didPrintPhase) {
								this.logInfo(`Running package phase: ${__stringify(phasesToRun.map(mapToName))}`);
								didPrintPhase = true;
							}

							if (!didPrintPackages) {
								this.logVerbose(` - on packages: ${__stringify(packages.map(mapToName))}`);
								didPrintPackages = true;
							}

							didRun = true;
							this.logDebug(`   - ${pkg.name}:${phase.name}`);
							if (this.dryRun) {
								await sleep(1000);
							} else
								await phase.action(pkg);
						}
					}));

					await Promise.all(values);
				};
			});

			if (this.terminate)
				return this.logInfo(`Skipping packages phases:`, phasesToRun.map(mapToName));

			for (const toRunPackage of toRunPackages) {
				await toRunPackage();
			}

			if (didRun && lastElement(phasesToRun)!.terminatingPhase)
				this.terminate = true;

			await nextAction?.();
		};
	}

	async execute(phases = this.phases) {
		return new MemStorage().init(async () => {
			await this.init();
			return (await this.prepare(phases))!();
		});
	}

	async executePhase(phaseKey: string) {
		const phase = this.phases.find(phase => phase.name === phaseKey);
		if (!phase)
			throw new BadImplementationException(`No Such Phase: ${phaseKey}`);

		const finalPhasesToRun = resolveAllMandatoryPhases(phase).reverse();
		return this.execute(finalPhasesToRun);
	}

}
