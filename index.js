const repl = require('repl');
const Eris = require('eris');
const stream = require('stream');
const axios = require('axios');

require('dotenv').config()

let repls = new Map();

const bot = new Eris(process.env.TOKEN);

class InputStream extends stream.Transform {
    constructor(options) {
        super(options);
    }

    _transform(chunk, encoding, callback) {
        this.push(chunk);
        callback();
    }
}

bot.on('messageCreate', async msg => {
    if (msg.author.id != process.env.OWNER) return;

    let params = msg.content.split(' ');

    if (params[0] === '!repl') {
        params.splice(0, 1);

        let evalInput = params.join(' ');

        if (repls.has(msg.author.id)) {
            let replStream = repls.get(msg.author.id);

            replStream.write(`${evalInput}\n`, 'utf8');
        } else {
            bot.createMessage(msg.channel.id, 'Creating REPL...');

            let input = new InputStream({});

            let output = new stream.Writable({
                write: async (chunk, encoding, callback) => {
                    let content = chunk.toString();

                    if (content.length > 2000) {
                        let res = await axios({
                            method: 'post',
                            url: 'https://hasteb.in/documents',
                            data: content,
                            headers: { "Content-Type": "text/plain" }
                        });

                        content = `**Output was too long and was uploaded to https://hasteb.in/${res.data.key}.js**`;
                    }

                    bot.createMessage(msg.channel.id, content);

                    callback();
                }
            });

            repls.set(msg.author.id, input);

            let r = repl.start({
                input,
                output
            });

            r.context.bot = bot;

            r.on('exit', () => {
                stream.finished(input, err => console.log(err));
                stream.finished(output, err => console.log(err));

                bot.createMessage(msg.channel.id, 'Closing REPL...');

                repls.delete(msg.author.id);
            });
        }
    }
});

bot.on('ready', () => {
    console.log('Ready to REPL');
});

bot.connect();