var path = require('path');
var fs = require('fs');
var crypto = require('crypto');
var jwt = require('jsonwebtoken');
const util = require("util");
const getFolderSize = util.promisify(require("get-folder-size"));

var express = require('express');
var router = express.Router();

const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

const authenticateJWT = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (authHeader) {
      const token = authHeader.split(' ')[1];

      jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, user) => {
          if (err) {
              return res.sendStatus(403);
          }

          req.user = user;
          next();
      });
  } else {
      res.sendStatus(401);
  }
};


router.post('/panel/login', async function(req, res, next) {
  console.log(req.body);

  const user = await prisma.panelUser.findUnique({
    where: {
      login: req.body.userData.login,
      password: req.body.userData.password
    }
  })

  res.setHeader('Content-Type', 'application/json');
  if (user) {
    var accessToken = jwt.sign({ username: user.login }, process.env.ACCESS_TOKEN_SECRET);
    /**await prisma.panelToken.create({
      data: {
        accessToken
      },
    })*/
    res.send({exists: true, accessToken});
  } else {
    res.send({exists: false });
  }
});

router.get('/panel/testToken', authenticateJWT, (req, res) => {
  res.send({valid: true});
});

router.get('/panel/status', authenticateJWT, async function(req, res, next) {
  var filesSize = await getFolderSize('uploads');
  console.log(filesSize);

  var filesCount = fs.readdirSync('uploads').length;
  console.log(filesCount);

  res.send({status: {version: process.env.npm_package_version, 
    uptime: process.uptime(), filesSize, filesCount}});
});

module.exports = router;
