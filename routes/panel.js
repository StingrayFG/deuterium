var path = require('path');
var fs = require('fs');
var crypto = require('crypto');
var jwt = require('jsonwebtoken');

var express = require('express');
var router = express.Router();

const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

router.post('/panel/login', async function(req, res, next) {
  console.log(req.body);
  //console.log(req.login);
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
    res.send(JSON.stringify({ exists: true, accessToken}));
  } else {
    res.send(JSON.stringify({ exists: false }));
  }
});

module.exports = router;
