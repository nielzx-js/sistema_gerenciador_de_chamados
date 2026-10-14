const express = require('express');
const path = require('path');
const pool = require('./database');
const app = express();
const PORT = 3000;
const nodemailer = require("nodemailer");




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
    }
});

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

  let codigoVerificacao;
app.post('/register', async (req,res)=>{
    const {email,senha1,senha2} = req.body
    if(senha1 !== senha2){
        return res.status(400).send("as senhas não são iguais")
    }

    /* inicio do trecho gerado por IA */
    codigoVerificacao = Math.floor(100000 + Math.random() * 900000);
    /* fim do trecho gerado por IA */
    await transporter.sendMail({
        from:process.env.EMAIL,
        to:email,
        subject:"código de verificação",
        text:`seu código de verificação é: ${codigoVerificacao}`
    })
   res.redirect('/verify')
})

//rota de verificação de duas etapas
app.get('/verify',(req,res)=>{
    res.render('verify')

})
app.post('/verify',(req,res)=>{
    const {codigoDigitado} = req.body
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

