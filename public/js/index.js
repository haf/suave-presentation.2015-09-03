import React from 'react';
// read up on how RxJS works here:
// https://xgrommx.github.io/rx-book/
import Rx from 'rx';
import RxReact from 'rx-react';
import Timer from './timer';
import mui from 'material-ui';
import sha1 from 'simple-sha1';

const {
  Styles,
  TextField,
  RaisedButton,
  Paper
} = mui;

const {
  FuncSubject,
  StateStreamMixin
} = RxReact;

const _ = require('./underscore.rx')(require('./underscore'));

///////////////////////
// First View – Name //
///////////////////////

const NameView = (function() {
  const handleChange = FuncSubject.create(),
        handleSubmit = FuncSubject.create(),
        inputValueStream = handleChange.map(e => e.target.value).startWith(''),
        textStream       = inputValueStream.merge(handleSubmit.map(''));

  return React.createClass({
    mixins: [
      StateStreamMixin
    ],

    getStateStream() {
      handleSubmit.subscribe(evt => {
        evt.preventDefault();
        if (this.props.handleName) {
          this.props.handleName(this.state.name);
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

////////////////////////
// Second View – Chat //
////////////////////////

// subcomponent of ChatView
const ChatLog = React.createClass({
  render() {
    const { messages } = this.props;
    return <Paper zDepth={1}>
      <dl className="chat-log">{messages.map((dto, index) =>
        [<dt key={"dt" + index + dto.messageId} className="metadata">{dto.userName}</dt>,
         <dd key={"dd" + index + dto.messageId} className="message">{dto.message}</dd>]
      )}</dl>
    </Paper>;
  }
});

const createChatMessage = function(userName, message) {
  let ts = _.now();
  return {
    userName: userName,
    message: message,
    timestamp: ts,
    messageId: sha1.sync(message + "\n" + ts)
  };
};

// the view where you chat
const ChatView = (function() {
  const handleSubmit = FuncSubject.create(),
        handleTyping = FuncSubject.create();

  return React.createClass({
    mixins: [
      StateStreamMixin
    ],

    getStateStream() {
      const submitStream = handleSubmit.publish(),
            typedValueStream = handleTyping.map(e => e.target.value).startWith(''),
            typedTextStream = typedValueStream.merge(submitStream.map(''));

      submitStream.subscribe(e => e.preventDefault())

      submitStream
        .withLatestFrom(
          typedValueStream,
          (evt, message) => createChatMessage(this.props.userName, message))
        .subscribe(this.props.handleSays);

      submitStream.connect();

      return typedTextStream.map(x => ({ typedText: x }));
    },

    render() {
      const { userName, messages } = this.props,
            { typedText } = this.state;

      return <form onSubmit={handleSubmit}>
        <ChatLog messages={messages} />

        <TextField hintText={userName + " says..."}
                   floatingLabelText="Tell it like it is!"
                   onChange={handleTyping}
                   value={typedText} />

        <RaisedButton label="Say."
                      primary={true}
                      type="submit" />
      </form>
    }
  });
})();

///////////////////////////////////
// The ChatApp (composing above) //
///////////////////////////////////

// the 'main' application component that deals with input-output to
// the server
let ChatApp = (function() {
  const handleName = FuncSubject.create(),
        handleSays = FuncSubject.create();

  handleSays
    .tap(console.log.bind(console, 'handleSays'))
    .subscribe(msg => {
      let apiMsg = _.merge(msg, { timestamp: new Date(msg.timestamp).toISOString() });
      _.request('POST', '/api/chat/send', apiMsg).retry(10)
        // need to subscribe to trigger send
        .subscribe(console.log.bind(console, '/api/chat/send'));
    });

  return React.createClass({
    mixins: [StateStreamMixin],

    getStateStream() {
      const nameStream = handleName.startWith(''),
            viewStream = handleName.map('chat').startWith('name'),
            // stub:
            // Rx.Observable.from([[createChatMessage('haf', 'sayz it like it izz') ]]);
            messagesReq =
              _.requestJSON('/api/chat/messages')
                .retry(3)
                .startWith([])
                .tap(console.log.bind(console, 'messages')),

            messagesStream =
              Rx.Observable.concat(
                messagesReq,
                _.requestESJSON('/api/chat/subscribe')
                  .retry(3)
                  .tap(console.log.bind(console, 'subscribe'))
                  .scan((acc, msg) => {
                    acc.push(msg);
                    return acc;
                  }, []));

      return Rx.Observable.combineLatest(
        nameStream, viewStream, messagesStream,
        (userName, view, messages) => ({userName, view, messages}));
    },

    render() {
      const { userName, view, messages } = this.state;
      return view === 'name'
        ? <NameView handleName={handleName} />
        : <ChatView messages={messages}
                    userName={userName}
                    handleSays={handleSays}/>;
    }
  });
})();

////////////////////////
// boilerplate below: //
////////////////////////

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