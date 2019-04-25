import React, { Component } from "react";
import { connect } from "react-redux";

import ReactColorSquare from "@deepeshk12apr/react-fun";

// Import actions
// import {
//   selectSubreddit,
//   fetchPostsIfNeeded,
//   invalidateSubreddit
// } from "../actions";

import * as actions from "../actions";

// Import components
import Navbar from "../components/Navbar";
import Posts from "./Posts";

import { Dimmer, Loader } from "semantic-ui-react";
import observeElementsInViewport from "../util/viewport";

class App extends Component {
  constructor(props) {
    super(props);

    this.handleMenuChange = this.handleMenuChange.bind(this);
    this.handleRefreshClick = this.handleRefreshClick.bind(this);
  }

  componentDidMount() {
    const { dispatch, selectedSubreddit } = this.props;
    console.log({ selectedSubreddit });
    this.props.fetchPostsIfNeeded(selectedSubreddit);
    observeElementsInViewport();
  }

  handleMenuChange(e, { name }) {
    const sub = name.replace(/ /g, "");
    this.props.selectSubreddit(sub);
    this.props.fetchPostsIfNeeded(sub);
  }

  handleRefreshClick() {
    const { dispatch, selectedSubreddit } = this.props;
    this.props.invalidateSubreddit(selectedSubreddit);
    this.props.fetchPostsIfNeeded(selectedSubreddit);
  }

  render() {
    const { selectedSubreddit, posts, isFetching } = this.props;
    return (
      <div>
        <Dimmer blurring active={isFetching}>
          <Loader>Loading</Loader>
        </Dimmer>
        <Navbar
          selectedSub={selectedSubreddit}
          handleMenuChange={this.handleMenuChange}
          handleRefreshClick={this.handleRefreshClick}
        />
        <ReactColorSquare height={150} color="red" text="Hello World!" />
        {posts.length > 0 && <Posts posts={posts} />}
      </div>
    );
  }
}

function mapStateToProps(state) {
  const { selectedSubreddit, postsBySubreddit } = state;
  const { isFetching, items: posts } = postsBySubreddit[selectedSubreddit] || {
    isFetching: true,
    items: []
  };

  return {
    selectedSubreddit,
    posts,
    isFetching
  };
}

export default connect(
  mapStateToProps,
  actions
)(App);
