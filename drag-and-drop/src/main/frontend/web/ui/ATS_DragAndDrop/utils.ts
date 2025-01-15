import {generateArray, generateHex} from '@nu-art/ts-common';
import {DNDTestItemStatuses, DNDTest_Item, DNDTest_Item_Status} from './types';

const getRandomStatus = (): DNDTest_Item_Status => {
	const randomNumber = Math.ceil(Math.random() * 100);
	return DNDTestItemStatuses[randomNumber % 3];
};

export const dndTest_generateItems = (): DNDTest_Item[] => {
	return generateArray(10, index => {
		return {
			label: `Task ${index + 1}`,
			id: generateHex(8),
			status: getRandomStatus(),
		};
	});
};

