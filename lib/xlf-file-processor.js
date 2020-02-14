"use strict";

const parseString = require('xml2js').parseString;
const Json2csvParser = require('json2csv').Parser;
const fs = require('fs');
const async = require('async');
const constants = require('./constants');
const csvToJson = require("csvtojson");
const xml2js = require('xml2js');
const StringUtil = require('./utils/string.util');

function XlfFileProcessor() {
    // constructor
}


XlfFileProcessor.prototype.getXlfMessages = function (xlfFile) {
    return xlfFile.xliff.file[0].body[0]['trans-unit'];
};

/**
 * Get the main source file
 * @param callback
 */
XlfFileProcessor.prototype.getXlfSourceFile = function (callback) {
    const xlfFilePath = `${appRoot}${translatorConfig.source}`;
    this.readXlfFile(xlfFilePath, (err, xlfSourceFile) => {
        callback(err, xlfSourceFile);
    })
};

/**
 * Get the xlf file and contents by locale id
 * @param locale
 * @param callback
 */
XlfFileProcessor.prototype.getXlFileForLocale = function (locale, callback) {
    const xlfFilePath = `${appRoot}${translatorConfig.outputPath}/${constants.OUTPUT_FILE_NAME}/${constants.OUTPUT_FILE_NAME}.${locale}.${constants.FILE_TYPE}`;
    this.readXlfFile(xlfFilePath, (err, xlfFile) => {
        callback(err, xlfFile);
    })
};

/**
 * Get all the message file names
 * @param callback
 */
XlfFileProcessor.prototype.listAllTranslatedXlfFileNames = function (callback) {
    const messageFilesDirPath = `${appRoot}${translatorConfig.outputPath}/${constants.OUTPUT_FILE_NAME}`;
    this.listFiles(messageFilesDirPath, (err, files) => {
        callback(err, files);
    })
};

/**
 * Get xlf file by file name
 * @param fileName
 * @param callback
 */
XlfFileProcessor.prototype.getXlfFileByName = function (fileName, callback) {
    const xlfFilePath = `${appRoot}${translatorConfig.outputPath}/${constants.OUTPUT_FILE_NAME}/${fileName}`;
    this.readXlfFile(xlfFilePath, (err, xlfFile) => {
        callback(err, xlfFile);
    })
};

/**
 * Get xlf file by file name
 * @param fileName
 * @param xlfFile
 * @param callback
 */
XlfFileProcessor.prototype.updateXlfFile = function (fileName, xlfFile, callback) {

    const builder = new xml2js.Builder();
    const xml = builder.buildObject(xlfFile);
    const path = `${appRoot}${translatorConfig.outputPath}/${constants.OUTPUT_FILE_NAME}/${fileName}`;

    this.createXlfFile(path, xml, (err) => {
        callback(err, xlfFile);
    });
};


/**
 * Check if a file exists
 * @param path
 * @param callback
 */
XlfFileProcessor.prototype.doesFileExist = function (path, callback) {
    fs.readFile(path, (err, file) => {

        if (err) {
            return callback(err);
        }
        if (!file) {
            return callback(null, false);
        }
        return callback(null, true);
    });
};

/**
 * Check if a directory exists
 * @param dir
 * @param callback
 */
XlfFileProcessor.prototype.dirExistOrCreate = function (dir, callback) {
    fs.mkdir(dir, function (e) {
        if (!e || (e && e.code === 'EEXIST')) {
            callback();
        } else {
            callback();
        }
    });
};

/**
 * Read the xlf file and get the xml as string
 * @param dir
 * @param callback
 */
XlfFileProcessor.prototype.readXlfFile = function (dir, callback) {

    async.waterfall([
        (callback) => {
            fs.readFile(dir, (err, data) => {
                callback(err, data);
            });
        },
        (data, callback) => {
            parseString(data.toString(), (err, xlfFileAsString) => {
                callback(err, xlfFileAsString)
            });
        }
    ], (err, xlfFile) => {
        callback(err, xlfFile)
    })
};

/**
 * Create the actual xlf file
 * @param {String} dir
 * @param {Array} data
 * @param callback
 */
XlfFileProcessor.prototype.createXlfFile = function (dir, data, callback) {
    const stream = fs.createWriteStream(dir);
    stream.once('open', () => {
        stream.write(data);
        stream.end();
        callback();
    });
};

/**
 * Create the csv for human manual translations
 * @param path
 * @param bodies
 * @param languageToTranslate
 * @param callback
 */
XlfFileProcessor.prototype.createCsvOutputFilesFromBody = function (path, bodies, languageToTranslate, callback) {

    const translations = bodies.map((body) => {
        if (body.source[0] instanceof Object) {
            let builder = new xml2js.Builder({explicitRoot: false, headless: true, trim: true});
            let xml = '';
            try {
                xml = builder.buildObject(body.source[0]);
            } catch(error) {
                console.log(error);
            }
            xml = StringUtil.removeRootTag(xml);
            xml = StringUtil.sanitize(xml);
            if (body.target[0] instanceof Object) {
                return {id: body.$.id, source: xml, target: xml};
            }
            return {id: body.$.id, source: xml, target: body.target[0]};
        }
        return {id: body.$.id, source: body.source[0], target: body.target[0]};
    });

    const csvPath = [path, constants.CSV,
        `messages.${languageToTranslate}.${constants.CSV}`].join('/');
    const fields = ['id', 'source', 'target'];
    const json2csvParser = new Json2csvParser({fields, doubleQuote: '\\"'});
    const csv = json2csvParser.parse(translations);

    fs.writeFile(csvPath, csv, (err) => {
        callback(err);
    });
};

/**
 * Save json to csv
 * @param csvFilePath
 * @param bodies
 * @param callback
 */
XlfFileProcessor.prototype.saveJsonToCsv = function (csvFilePath, bodies, callback) {

    const fields = ['id', 'source', 'target'];
    const json2csvParser = new Json2csvParser({fields, doubleQuote: '"'});
    const csv = json2csvParser.parse(bodies);

    async.waterfall([
        (callback) => {
            fs.unlink(csvFilePath, (err) => {
                callback(err);
            });
        },
        (callback) => {
            fs.writeFile(csvFilePath, csv, (err) => {
                callback(err);
            });
        }
    ], (err) => {
        callback(err);
    });
};


/**
 * Read and parse a csv file within a directory
 * @param csvFilePath
 * @param callback
 */
XlfFileProcessor.prototype.readAndParseCsvToJson = function (csvFilePath, callback) {
    csvToJson({escape: '\\'}).fromFile(csvFilePath)
        .then((jsonObj) => {
            callback(null, jsonObj);
        })
};

/**
 * List all src from a directory
 * @param dir
 * @param callback
 */
XlfFileProcessor.prototype.listFiles = function (dir, callback) {
    fs.readdir(dir, (err, files) => {
        callback(err, files)
    })
};

module.exports = new XlfFileProcessor();
