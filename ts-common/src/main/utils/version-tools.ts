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


import {BadImplementationException} from "../index";

/**
 *
 * @param firstVersion a version
 * @param secondVersion another version
 *
 * @return -1 if first is greater
 *          0 if versions match
 *          1 if second is greater
 */
export function compareVersions(firstVersion: string, secondVersion: string) {
	if (!firstVersion)
		throw new BadImplementationException("First version is undefined");

	if (!secondVersion)
		throw new BadImplementationException("Second version is undefined");

	const firstVersionAsArray = firstVersion.split("\.");
	const secondVersionAsArray = secondVersion.split("\.");
	for (let i = 0; i < firstVersionAsArray.length; i++) {
		const secondVal = +secondVersionAsArray[i];
		const firstVal = +firstVersionAsArray[i];
		if (secondVal > firstVal)
			return 1;

		if (secondVal === firstVal)
			continue;

		if (secondVal < firstVal)
			return -1;
	}

	return 0;
}