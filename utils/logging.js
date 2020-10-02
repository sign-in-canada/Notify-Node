const
	fs = require('fs'),
	winston = require('winston'),
	dailyRotateFile = require('winston-daily-rotate-file'),
	R = require('ramda'),
	sha1 = require('sha1'),
	format = winston.format

const
	dir = R.defaultTo(__dirname + '/logs', process.env.NODE_LOGS),

	defaultLogOptions = {
		filename: dir + '/notify-%DATE%.log',
		handleExceptions: true,
		datePattern: 'YYYY-MM-DD',
		maxSize: '20m',
	},
	flogOpts = {
		filename: dir + '/notify.log',
		maxSize: defaultLogOptions.maxSize,
		maxFiles: 5,
		options: { flags : 'w' }
	},
	logger = winston.createLogger({
				exitOnError: false,
				format: format.combine(
					format.splat(),
					format.padLevels(),
					format.timestamp(),
					format.printf(info => `${info.timestamp} [${info.level.toUpperCase()}] ${info.message}`)
				)
			})

logger.stream = {
    write: (message, enc) => log2('info', message.trim())
}

var transport, fileTransport, consoleTransport
var prevConfigHash = 0

if (!fs.existsSync(dir)){
	fs.mkdirSync(dir)
}

function addFileTransport(level) {
	fileTransport = new winston.transports.File(R.assoc('level', level, flogOpts))
	logger.add(fileTransport, {}, true)
}

function configure(cfg) {

	//let h = misc.hash(cfg) 
	let h = sha1(JSON.stringify(cfg));
	//Only makes recomputations if config data changed
	if (h != prevConfigHash) {

		prevConfigHash = h
		let level = R.defaultTo('info', cfg.level)

		//Remove console log + rotary file transports
		R.forEach(l => logger.remove(l), R.filter(R.complement(R.isNil), [transport, consoleTransport]))

		if (R.propEq('consoleLogOnly', true, cfg)) {
			consoleTransport = new winston.transports.Console({ level: level })
			logger.add(consoleTransport, {}, true)

			if (fileTransport) {
				logger.remove(fileTransport)
				fileTransport = undefined
			}
		} else {

			if (fileTransport) {
				fileTransport.level = level
			} else {
				addFileTransport(level)
			}

			transport = new dailyRotateFile(R.assoc('level', level, defaultLogOptions))
			transport.on('rotate', function(oldFilename, newFilename) {
				//remove method flushes passport.log file
				logger.remove(fileTransport)
				addFileTransport(level)
			})
			logger.add(transport, {}, true)
		}

		log2('info', 'Loggers reconfigured')
	}
}

function log2(level, msg) {

	//npm log levels (https://github.com/winstonjs/winston#logging-levels)
	let levels = ['error', 'warn', 'info', 'verbose', 'debug', 'silly']
	level = level.toLowerCase()
	level = R.includes(level, levels) ? level : 'info'

	msg = R.defaultTo('', msg)

	//Convert arguments to a real array (https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Functions/arguments#Description)
	args = [].slice.call(arguments)
	args[0] = level
	args[1] = msg

	//Log it to winston logger
	logger.log.apply(logger, args)

	//Log it to MQ
	args[1] = level + ": " + args[1]
	args.shift()
}

module.exports = {
	logger: logger,
	configure: configure,
	log2: log2
}
