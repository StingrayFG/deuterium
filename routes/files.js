var express = require('express');
var router = express.Router();

var upload = multer({ dest: "uploads/" });

router.get('/', function(req, res, next) {
  res.send('file');
});

router.post('/', upload.single('file'), function(req, res, next) {
  console.log('post')
});

module.exports = router;
