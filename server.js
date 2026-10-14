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

     const query = 'SELECT * FROM usuarios WHERE email = $1';
    const result = await pool.query(query, [email]);

    if (result.rows.length > 0) {
     return res.send(`
        <script>
            alert('Usuário já cadastrado');
            history.back();
        </script>
    `);
}
   
  
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
            html:`
            <div style="
            background-color: #0b080b;
            padding: 35px 20px;
            font-family: Arial, sans-serif;
            color: #F4EDF3;
        ">
            <div style="
                max-width: 450px;
                margin: 0 auto;
                background-color: #160f15;
                border: 1px solid #51404F;
                border-radius: 12px;
                padding: 30px;
                text-align: center;
            ">
                <h1 style="
                    color: #A875A0;
                    font-size: 25px;
                    margin-bottom: 20px;
                ">
                    Verificação de conta
                </h1>

                <p style="
                    color: #B7A8B5;
                    font-size: 15px;
                    line-height: 1.6;
                ">
                    Utilize o código abaixo para confirmar seu e-mail.
                </p>

                <div style="
                    background-color: #211720;
                    border: 1px solid #51404F;
                    border-radius: 8px;
                    padding: 18px 10px;
                    margin: 25px 0;
                ">
                    <span style="
                        color: #A875A0;
                        font-size: 30px;
                        font-weight: bold;
                        letter-spacing: 8px;
                    ">
                        ${codigoVerificacao}
                    </span>
                </div>

                <p style="
                    color: #B7A8B5;
                    font-size: 13px;
                    line-height: 1.5;
                ">
                    Este código é válido por 10 minutos.
                    Não compartilhe com ninguém.
                </p>

                <div style="
                    border-top: 1px solid #51404F;
                    margin-top: 25px;
                    padding-top: 18px;
                ">
                    <p style="
                        color: #B7A8B5;
                        font-size: 12px;
                        margin: 0;
                    ">
                        Se você não solicitou este cadastro,
                        ignore esta mensagem.
                    </p>
                </div>
            </div>
        </div>
            `

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
app.post('/verify',async (req,res)=>{
    const {codigoDigitado} = req.body
    const cadastro=req.session.cadastro
    if(!cadastro){
        return res.status(400).send("Cadasto expirado")
    }

    console.log('Código salvo:', cadastro.codigoVerificacao);
    console.log('Código digitado:', codigoDigitado);
    console.log('Cadastro na sessão:', cadastro);
    if(String(cadastro.codigoVerificacao)===String(codigoDigitado)){
        try{
          const query = 'INSERT INTO usuarios (email, senha) VALUES ($1, $2) RETURNING id, email';
          const values = [cadastro.email, cadastro.senhaHash];  
          const result= await pool.query(query,values)
          delete req.session.cadastro
          return res.redirect('/inicio')
        }catch(error){
          console.error('Erro ao salvar usuário no Neon:', error);
          return res.status(500).send("Erro ao finalizar cadastro no banco de dados.");
        }
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
