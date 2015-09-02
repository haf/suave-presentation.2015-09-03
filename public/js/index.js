import React from 'react';
// read up on this here
// https://xgrommx.github.io/rx-book/
import Rx from 'rx';
import RxReact from 'rx-react';
import Timer from './timer';
import mui from 'material-ui';

const {
  Styles,
  TextField,
  RaisedButton
} = mui;

const {
  FuncSubject,
  StateStreamMixin
} = RxReact;


const ChatLog = React.createClass({
  render() {
    const { items } = this.props;
    return (
      <ul>{items.map((itemText, index) =>
        <li key={index + itemText}>{itemText}</li>
      )}</ul>
    );
  }
});

const ChatView = React.createClass({
  render() {
    return <div>
      <ChatLog />
      <TextField hintText="Write your chat message here!"
                 floatingLabelText="Tell it like it is!" />
      <RaisedButton label="Send" primary={true} />
    </div>
  }
});

const NameView = (function() {
  const handleChange = FuncSubject.create(),

        handleSubmit = FuncSubject.create(),

        inputValueStream = handleChange.map(e => e.target.value).startWith(''),

        textStream = inputValueStream.merge(handleSubmit.map(''));

  return React.createClass({
    mixins: [
      StateStreamMixin
    ],

    getStateStream() {
      handleSubmit.subscribe(evt => {
        evt.preventDefault();
        if (this.props.handleName) {
          this.props.handleName.onNext(this.state.name);
        }
      });

      return textStream.map(name => ({ name }));
    },

    render() {
      return <div>
        <h2>Name?</h2>
        <form onSubmit={handleSubmit}>
          <TextField onChange={handleChange}
                     value={this.state.name}
                     hintText="Your Name in the Chat" />
          <RaisedButton label="Smooth!"
                        type="submit"
                        primary={true} />
        </form>
      </div>;
    }
  });
})();

let ChatApp = (function() {
  const onChange = FuncSubject.create();

  const handleSubmit =
    FuncSubject.create(e => e.preventDefault());

  const inputValueStream =
    onChange.map(e => e.target.value).startWith('');

  const itemsStream =
    handleSubmit
      .withLatestFrom(inputValueStream, (_, text) => text )
      .scan((items, text) => items.concat(text), [])
      .startWith([]);

  const viewStream =
    handleSubmit
      .map('')
      .startWith('name');

  const stateStream =
    Rx.Observable.combineLatest(
      viewStream,
      itemsStream,
      (view, items) => ({view, items}));

  const getStateStream = function () {
    return stateStream;
  };

  const render = function() {
    return this.state.view === 'name'
      ? <NameView />
      : <ChatView items={this.state.items} />;
  };

  return React.createClass({
    mixins: [StateStreamMixin],
    render,
    getStateStream
  });
})();

let App = (function() {
  let injectTapEventPlugin = require("react-tap-event-plugin");
  injectTapEventPlugin();

  let ThemeManager = new Styles.ThemeManager();
  ThemeManager.setTheme(ThemeManager.types.DARK);
  require('../css/index.styl');

  return React.createClass({
    childContextTypes: {
      muiTheme: React.PropTypes.object
    },
    getChildContext() {
      return {
        muiTheme: ThemeManager.getCurrentTheme()
      };
    },
    render() {
      return <ChatApp />;
    }
  });
})();

document.addEventListener("DOMContentLoaded", evt => {
  React.render(<App />, document.body);
});