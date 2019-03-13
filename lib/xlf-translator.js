const fs = require('fs');
const async = require('async');
const translate = require('@k3rn31p4nic/google-translate-api');
const errors = require('./errors');
const StringUtil = require('./utils/string.util');

function XlfTranslator() {
    // constructor
}

/**
 * Read the xlf file and get the xml as string
 * @param body
 * @param fromLanguage
 * @param toLanguage
 * @param callback
 */
XlfTranslator.prototype.translateBody = function (body, fromLanguage, toLanguage, callback) {

    if (toLanguage.indexOf('-')) {
        toLanguage = toLanguage.split('-')[0];
    }

    const translatedBody = [];
    async.each(body, (item, next) => {

        const text = StringUtil.sanitize(item.source[0]);
        item.source[0] = text;

        this.translateString(text, fromLanguage, toLanguage, (err, translatedString) => {
            const target = {target: [translatedString]};
            const newTranslatedItem = Object.assign(target, item);
            translatedBody.push(newTranslatedItem);
            next(err);
        });
    }, (err) => {

        if (!translatedBody.length) {
            return callback(new Error(errors.COULD_NOT_TRANSLATE.description));
        }

        if (err && err.code === 'BAD_REQUEST') {
            return callback(new Error(errors.GOOGLE_LIMIT_REACHED.description));
        }

        callback(null, translatedBody);
    });
};

/**
 * Translate the string with google translate
 * @param string
 * @param fromLanguage
 * @param toLanguage
 * @param callback
 */
XlfTranslator.prototype.translateString = function (string, fromLanguage, toLanguage, callback) {

    translate(string, {from: fromLanguage, to: toLanguage}).then(res => {
        console.info(`translated -> ${string} to ${toLanguage}`);
        callback(null, res.text);

    }).catch(err => {
        if (err) {
            return callback(err);
        }
    });
};

module.exports = new XlfTranslator();
