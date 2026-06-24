import {ComponentSync, LL_V_L} from '@nu-art/thunderstorm-frontend';
import {SearchContext, SearchItem, SearchResult, SearchResultsRenderer} from '../../../_core/index.js';
import './Component_SearchResults.scss';
import {TypedMap} from '@nu-art/ts-common';
import {Virtuoso} from 'react-virtuoso';

type Props = {
	context: SearchContext;
};

type State = {
	searchResults?: SearchResult[];
	listHeight?: number;
};

export class Component_SearchResults
	extends ComponentSync<Props, State>
	implements SearchResultsRenderer {

	//######################### Life Cycle #########################

	protected deriveStateFromProps(nextProps: Props, state: State) {
		state.searchResults ??= nextProps.context.getSearchResults();
		return state;
	}

	__onSearchResultsChanged = () => {
		this.setState({searchResults: this.props.context.getSearchResults()});
	};

	componentDidMount() {
		this.props.context.searchResultChangeListeners.register(this);
	}

	componentWillUnmount() {
		this.props.context.searchResultChangeListeners.unregister(this);
	}

	//######################### Render #########################

	private getSearchItemMap = () => {
		return this.props.context.getActiveSearchItems().reduce((map, searchItem) => {
			map[searchItem.module.dbDef.dbKey] = searchItem;
			return map;
		}, {} as TypedMap<SearchItem<any, any>>);
	};

	//######################### Render #########################

	render() {
		const searchItemMap = this.getSearchItemMap();
		const results = this.state.searchResults?.filter(result => searchItemMap[result.dbKey]);
		if (!results?.length)
			return this.render_NoResults();

		return <Virtuoso
			className={'c__search-results'}
			data={results}
			style={{height: 0}}
			itemContent={(_, result) => searchItemMap[result.dbKey].resultRenderer(result)}
			totalListHeightChanged={listHeight => {
				if (listHeight > 0 && this.state.listHeight !== listHeight)
					this.setState({listHeight});
			}}
		/>;
	}

	private render_NoResults = () => {
		return <LL_V_L className={'c__search-results no-results'}>
			No results to show
		</LL_V_L>;
	};
}