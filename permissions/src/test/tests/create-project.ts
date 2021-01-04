/*
 * ts-common is the basic building blocks of our typescript projects
 *
 * Copyright (C) 2020 Intuition Robotics
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import {
	__scenario,
	ContextKey,
    __custom
} from "@ir/testelot";
import {
	cleanup,
	ConfigDB,
	setupDatabase,
	testConfig1,
	testLevel1,
	testLevel2
} from "./_core";
import {AccessLevelPermissionsDB} from "../_main";

const contextKey = new ContextKey<ConfigDB>("config-1");


export function createTwoAccessLevels() {
	const scenario = __scenario("Create two access levels");
	scenario.add(cleanup());
	scenario.add(setupDatabase(testConfig1, testLevel1).setWriteKey(contextKey));
	scenario.add(__custom(async (action, data) => {
		await AccessLevelPermissionsDB.upsert({...testLevel2, domainId: data.domain._id});
	}).setReadKey(contextKey).setLabel("Add second access level"));
	return scenario;
}

