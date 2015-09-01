import { StateStreamMixin } from 'rx-react';
import React from 'react';
import Rx from 'rx';

var Timer = React.createClass({
  mixins: [
    StateStreamMixin
  ],

  getInitialState() { return {}; },

  getStateStream() {
    return Rx.Observable.interval(1000).map(function (interval) {
      return {
        secondsElapsed: interval
      };
    });
  },

  render() {
    var secondsElapsed = this.state ? this.state.secondsElapsed : 0;
    return (
      <div>Seconds Elapsed: {secondsElapsed}</div>
    );
  }
});

React.render(<Timer />, document.getElementById('timer-holder'));