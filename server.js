const express = require('express');
const path = require('path');

const app = express();
const PORT = 3000;

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());



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
app.post('/register',(req,res)=>{
    const {senha1,senha2} = req.body
    if(senha1 !== senha2){
        return res.status(400).send("as senhas não são iguais")
    }

    //confirmação
})

//recuperação de senha
app.get('/resetpassword',(req,res)=>{
    res.render('resetpassword')
})

app.listen(PORT,()=>{
    console.log(`rodando em: http://localhost:${PORT}`)
})

