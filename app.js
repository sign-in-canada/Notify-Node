const express = require('express');
const bodyParser = require('body-parser');
const R = require('ramda');
const app = express();
const logger = require('./utils/logging');
const notifyFile = '/etc/gluu/conf/notify-config.json';

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

var apiUrl, emailAddress, emailTemplateId;
const apiKey = process.env.NOTIFY_KEY;
const httpPort = process.env.PORT || 8097;

function pathsHaveData(list, obj) {
	let pred = R.pathSatisfies(R.anyPass([R.isNil, R.isEmpty]))
	pred = R.anyPass(R.map(pred, list))
	return !pred(obj)
}

const hasData = (list, obj) => pathsHaveData(R.map(x => [x], list), obj);

//Default error handler
app.use((err, req, res, next) => {
	logger.log2('error', `Unknown Error: ${err}`)
	logger.log2('error', err.stack)
});

app.post('/gc/services/notify', (req, res) => {
    const data = req.body;
    var pbList = JSON.stringify(data, function (key, value) {
      if (Array.isArray(value)) {
        return value[0];
      } else {
        return value;
      }
    });
    
    var mailPersonalisation = JSON.parse(pbList);
    mailPersonalisation.sourceURL = req.headers.referer;

    var NotifyClient = require('notifications-node-client').NotifyClient;
    var notifyClient = new NotifyClient(apiUrl, apiKey);
    
    notifyClient
      .sendEmail(emailTemplateId, emailAddress, {
        personalisation: mailPersonalisation,
        reference: null,
        emailReplyToId: null
      })
      .then(response => logger.log2('info', 'Notification sent successfully'))
      .catch(err => logger.log2('error', 'Notification failed with errors'))

    res.end();
});

app.listen(httpPort, '127.0.0.1', () => {
    logger.log2('info', `GC application service started on port ${httpPort}`);   
});

function init() {
  //Read the minimal params to start
  let basicConfig = require(notifyFile);
  //Start logging with basic params
  logger.configure({ level: basicConfig.logLevel, consoleLogOnly: basicConfig.consoleLogOnly });

  let props = ['apiUrl', 'emailAddress', 'emailTemplateId']
  if ( hasData(props, basicConfig) ) {
    //Try to gather the configuration
    apiUrl = basicConfig.apiUrl;
    emailAddress = basicConfig.emailAddress;
    emailTemplateId = basicConfig.emailTemplateId;
  } else {
    logger.log2('error', 'notify-config file is missing data')
  }
}

init()
