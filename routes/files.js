var express = require('express');
var router = express.Router();

var multer = require('multer');
var path = require('path')

var storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/')
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + path.extname(file.originalname)) //Appending extension
  }
})

var upload = multer({ storage: storage });

router.get('/', function(req, res, next) {
  res.send('file');
});

router.post('/', upload.single('file'), function(req, res, next) {
  console.log('post')
});

module.exports = router;
