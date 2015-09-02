import { StateStreamMixin } from 'rx-react';
import React from 'react';
import Rx from 'rx';

export default React.createClass({
  mixins: [
    StateStreamMixin
  ],

  getInitialState() {
    return {
      secondsElapsed: 0
    };
  },

  getStateStream() {
    return Rx.Observable.interval(1000).map(function (interval) {
      return {
        secondsElapsed: (interval + 1)
      };
    });
  },

  render() {
    var secondsElapsed = this.state ? this.state.secondsElapsed : 0;
    return <div>Seconds Elapsed: {secondsElapsed}s</div>;
  }
});

