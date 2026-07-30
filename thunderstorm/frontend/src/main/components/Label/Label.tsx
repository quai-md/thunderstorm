import * as React from 'react';
import {ComponentSync} from '../../core/ComponentSync.js';
import {_className} from '../../utils/tools.js';
import './Label.scss';
import {OnWindowResized} from '../../modules/ModuleFE_Window.js';
import {Debounce} from '@nu-art/ts-common';

type Props = React.PropsWithChildren<{
	tooltip?: React.ReactNode; //The content that will appear in the tooltip
	className?: string;
	containerSelector?: string; //A container for the tooltip direction calculation
	onClick?: (e: React.MouseEvent<HTMLDivElement>) => void;
	forceUpdate?: boolean;
}>;

type State = {
	tooltip: React.ReactNode;
	className?: string;
	containerSelector?: string;
	forceUpdate: boolean;
};

export class Label
	extends ComponentSync<Props, State>
	implements OnWindowResized {

	private readonly labelRef = React.createRef<HTMLDivElement>();
	private readonly activeTooltipClass = 'tooltip-active';
	private readonly invertTooltipClass = 'invert-tooltip';
	private readonly debouncer = new Debounce(() => this.checkOverflow(), 50, 150);

	// ######################## Life Cycle ########################

	__onWindowResized() {
		this.debouncer.trigger();
	}

	protected deriveStateFromProps(nextProps: Props, state: State): State {
		state.tooltip = nextProps.tooltip ?? '';
		state.className = nextProps.className;
		state.containerSelector = nextProps.containerSelector;
		state.forceUpdate = !!nextProps.forceUpdate;
		return state;
	}

	public shouldComponentUpdate(nextProps: Readonly<Props>, nextState: Readonly<State>, nextContext: any): boolean {
		return nextState.forceUpdate || super.shouldComponentUpdate(nextProps, nextState, nextContext);
	}

	componentDidMount() {
		this.debouncer.trigger();
		this.observer.attach();
	}

	componentDidUpdate() {
		this.debouncer.trigger();
	}

	public componentWillUnmount() {
		this.observer.detach();
	}

	// ######################## Logic ########################

	private checkOverflow = (secondCheck: boolean = false) => {
		const el = this.labelRef.current;
		if (!el)
			return;

		const contentEl = el.children[0] as HTMLDivElement;
		if (!contentEl)
			return;

		const contentOverflowing = contentEl.offsetWidth < contentEl.scrollWidth;
		if (contentOverflowing) { //Currently truncated
			el.classList.add(this.activeTooltipClass);
		} else { //Currently not truncated
			el.classList.remove(this.activeTooltipClass);
			if (!secondCheck)
				this.checkOverflow(true);
		}
	};

	private checkTooltipDir = () => {
		const el = this.labelRef.current;
		if (!el || !this.state.containerSelector)
			return;

		const container = el.closest(this.state.containerSelector);
		if (!container)
			return;

		const containerTop = container.getBoundingClientRect().top;
		const labelRect = el.getBoundingClientRect();
		const distance = labelRect.top - containerTop;
		//Should be inverted
		if (distance <= labelRect.height * 2.5) {
			if (!el.classList.contains(this.invertTooltipClass))
				el.classList.add(this.invertTooltipClass);
		} else { //Should not be inverted
			if (el.classList.contains(this.invertTooltipClass))
				el.classList.remove(this.invertTooltipClass);
		}
	};

	private getProps = () => {
		const {tooltip, className, containerSelector, onClick, forceUpdate, ...rest} = this.props;
		return {
			...rest,
			className: _className('ts-label', className),
			'data-tooltip': this.state.tooltip,
			onMouseEnter: this.checkTooltipDir,
			onClick,
			ref: this.labelRef,
		};
	};

	private observer = {
		observer: new ResizeObserver(() => this.checkOverflow()),
		attach: () => {
			const el = this.labelRef.current;
			if (!el)
				return;

			this.observer.observer.observe(el);
		},
		detach: () => this.observer.observer.disconnect(),
	};

	// ######################## Render ########################

	render() {
		return <div {...this.getProps()}>
			<div className={'ts-label__content'}>{this.props.children}</div>
		</div>;
	}
}