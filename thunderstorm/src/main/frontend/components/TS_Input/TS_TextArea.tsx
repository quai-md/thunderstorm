/*
 * Thunderstorm is a full web app framework!
 *
 * Typescript & Express backend infrastructure that natively runs on firebase function
 * Typescript & React frontend infrastructure
 *
 * Copyright (C) 2020 Adam van der Kruk aka TacB0sS
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

import * as React from 'react';
import {KeyboardEvent} from 'react';
import {TS_BaseInput, TS_BaseInputProps} from './TS_BaseInput';
import './TS_TextArea.scss';
import {_className} from '../../utils/tools';
import {getComputedStyleProperty} from '../utils';


export type TS_TextAreaProps<Key> = TS_BaseInputProps<Key, HTMLTextAreaElement> & {
	resizeWithText?: boolean;
}

export class TS_TextArea<Key extends string>
	extends TS_BaseInput<Key, TS_TextAreaProps<Key>, HTMLTextAreaElement> {

	componentDidMount() {
		if (this.state.value && this.props.resizeWithText)
			this.resizeWithText();
	}

	onKeyDown = (ev: KeyboardEvent<HTMLTextAreaElement>) => {
		if (!(ev.shiftKey || ev.altKey)) {
			if (ev.ctrlKey || ev.metaKey) {
				if (ev.key === 'Enter') {
					ev.persist();
					const value = ev.currentTarget.value;

					//@ts-ignore - despite what typescript says, ev.target does have a blur function.
					ev.target.blur();

					if (this.props.onAccept) {
						this.props.onAccept(value, ev);
						ev.stopPropagation();
					}
				}
				return;
			}

			if (ev.key === 'Escape' && this.props.onCancel) {
				this.props.onCancel();
				ev.stopPropagation();
			}
		}

		this.props.onKeyDown?.(ev);
	};

	resizeWithText = () => {
		const el = this.ref as HTMLTextAreaElement;
		if (!el)
			return;

		const currentHeight = el.offsetHeight;

		if (el.scrollHeight > currentHeight) { //Can increase height
			const newHeight = el.scrollHeight + 5;
			el.style.height = `${newHeight}px`;
		} else { //Check if height needs to be decreased
			const borderWidthTop = Number(getComputedStyleProperty(el, 'border-top-width')?.replace('px', ''));
			const borderWidthBottom = Number(getComputedStyleProperty(el, 'border-bottom-width')?.replace('px', ''));
			const borderWidth = borderWidthTop + borderWidthBottom;
			el.style.height = '1px';
			const scrollHeight = el.scrollHeight;
			const heightDiff = currentHeight - scrollHeight;
			const newHeight = heightDiff <= borderWidth + 1 ? currentHeight : scrollHeight + borderWidth + 1;
			el.style.height = `${newHeight}px`;
		}
	};


	_changeValue = (e: React.ChangeEvent<HTMLTextAreaElement | HTMLInputElement>) => {
		this.changeValue(e);
		if (this.props.resizeWithText)
			this.resizeWithText();
	};

	render() {
		const {onAccept, focus, enable, resizeWithText, ...props} = this.props;

		return <textarea
			{...props}
			ref={input => {
				if (this.ref || !input)
					return;

				this.ref = input;
				this.props.focus && this.ref.focus();
			}}
			onBlur={(event) => {
				this.ref = undefined;
				const value = event.target.value;
				this.setState({value});
				this.props.onBlur?.(value, event);
			}}
			disabled={this.props.disabled}
			name={this.props.name || this.props.id}
			key={this.props.id}
			id={this.props.id}
			className={_className('ts-textarea', this.props.className)}
			style={this.props.style}
			value={this.state.value}
			placeholder={this.props.placeholder}
			onChange={this._changeValue}
			onKeyDown={this.props.onKeyDown || this.onKeyDown}
			autoComplete={this.props.autoComplete ? 'on' : 'off'}
			spellCheck={this.props.spellCheck}
		/>;
	}
}