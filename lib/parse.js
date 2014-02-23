var fs = require('fs'),
    path = require('path'),
    mkdirp = require('mkdirp'),
    http = require('http'),
    byline = require('byline'),
    print = console.log;

var source = process.argv[2],
    destination = process.argv[3],
    input,
    processor = processHeader,
    separator = '\t',
    fieldNames,
    lineCount = 0,
    recordCount = 0,
    maxIdLength = 8;


function processStream(source) {
  var stream = fs.createReadStream(source)

  // Process data by line as long as there is a processor
  input = byline(stream).on('data', function (line) {
    lineCount++;
    if (processor)
      processor(line);
    else
      stream.destroy();
  })
  .on('end', function () {
    print('Converted ' + recordCount + ' records to JSON files in ' + destination);
  });
}

/* Process the header line of a TSV file. */
function processHeader(line) {
  // Split line into field names
  fieldNames = line.split(separator);
  if (fieldNames.length < 2) {
    die('Expected at least two fields, but got:\n' + line);
  }

  // Report about found field names
  print('Found ' + fieldNames.length + ' fields:');
  print(' - ' + fieldNames.join('\n - '));
  print('ID field is ' + fieldNames[0]);

  // Process the next line as a record
  processor = processRecord;
}

/* Process a record line of a TSV file. */
function processRecord(line) {
  // Split line into fields
  var fields = line.split(separator);
  // Skip empty lines
  if (fieldNames.length < 2)
    return;

  // Determine record ID
  var id = fields[0];
  if (!id.match(/^\d+$/)) {
    die('Expected row identifier to be numeric, ' +
        'but got "' + id + '" at line ' + lineCount);
  }

  // Determine file name
  var fileName = destination;
  for (var i = 0; i < maxIdLength; i++) {
    // Start new folder every two digits, to avoid congestion
    if (i % 2 === 0)
      fileName += '/';
    // Pad with leading zeroes if necessary
    fileName += id[id.length + i - maxIdLength] || '0';
  }
  fileName += '.json';

  // Generate object from record
  var record = Object.create(null);
  for (var i = 0; i < Math.min(fields.length, fieldNames.length); i++)
    record[fieldNames[i]] = fields[i];
  recordCount++;

  // Create file in directory, and pause input while doing so
  input.pause();
  var dirName = path.dirname(fileName);
  mkdirp(dirName, function (err) {
    if (err) die(err);
    fs.writeFile(fileName, JSON.stringify(record), function (err) {
      if (err) die(err);
      // Resume input
      input.resume();
    });
  });
}