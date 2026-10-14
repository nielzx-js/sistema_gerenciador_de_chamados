const express = require('express');
const path = require('path');
const pool = require('./database');
const app = express();
const PORT = 3000;
const nodemailer = require("nodemailer");
const bcrypt = require('bcrypt');
const session = require('express-session');
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

//transporter

const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
        user: process.env.EMAIL,
        pass: process.env.EMAIL_SENHA
    },
    connectionTimeout: 15000,
    greetingTimeout: 10000,
    socketTimeout: 30000
});

//session
app.use(session({
    secret:process.env.SESSION_SECRET,
    resave:false,
    saveUninitialized: false
}))


//login
app.get('/',(req,res)=>{
    res.render('index')
})


//inicio
app.get('/inicio',(req,res)=>{
    res.render("dashboard")
})


//cadastro


app.get('/register',(req,res)=>{
    res.render("register")
})

  
app.post('/register', async (req,res)=>{
     
    const {email,senha1,senha2} = req.body
  
    if(senha1 !== senha2){
        return res.status(400).send("as senhas não são iguais")
    }

    try {
       let senhaHash= await bcrypt.hash(senha1, 10);
        const codigoVerificacao = Math.floor(100000 + Math.random() * 900000);
        await transporter.sendMail({
            from:process.env.EMAIL,
            to:email,
            subject:"código de verificação",
            text:`seu código de verificação é: ${codigoVerificacao}`
        })
         req.session.cadastro = {
         email,
         senhaHash,
         codigoVerificacao
        };  
    } catch (error) {
        console.error('Erro ao preparar cadastro ou enviar e-mail de verificação:', error);
        return res.status(500).send("Não foi possível enviar o e-mail de verificação. Confira as configurações de e-mail do servidor e tente novamente.");
    }
   
   res.redirect('/verify')
})

//rota de verificação de duas etapas
app.get('/verify',(req,res)=>{
    res.render('verify')

})
app.post('/verify',(req,res)=>{
    const {codigoDigitado} = req.body
    const cadastro=req.session.cadastro
    if(!cadastro){
        return res.status(400).send("Cadasto expirado")
    }
    if(String(codigoVerificacao)===codigoDigitado){
        res.redirect('/inicio')
    }
return res.status(400).send("Codigo incorreto")
})


//para ver se o servidor tá rodando
app.get('/status-db', async (req, res) => {
  try {
    const result = await pool.query('SELECT NOW()');
    res.json({ status: 'Online', servidor_tempo: result.rows[0].now });
  } catch (error) {
    res.status(500).json({ erro: 'Erro ao conectar ao banco' });
  }
});

//recuperação de senha
app.get('/resetpassword',(req,res)=>{
    res.render('resetpassword')
})





app.listen(PORT,()=>{
    console.log(`rodando em: http://localhost:${PORT}`)
})
