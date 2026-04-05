import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const tfjsNodeDllPath = path.join(
    __dirname,
    'node_modules',
    '@tensorflow',
    'tfjs-node',
    'deps',
    'lib'
);

if (process.platform === 'win32') {
    process.env.PATH = `${tfjsNodeDllPath};${process.env.PATH}`;
}

const { default: tf } = await import('@tensorflow/tfjs-node');

async function trainModel(inputXs, outputYs) {
    const model = tf.sequential()

    // Primeira camada da rede:
    // entrada de 7 posições (idade normalizada + 3 cores + 3 localizações)

    // 80 neuronios = aqui coloquei tudo isso pq tem pouca base de treino
    // quanto mais neuronios, mais complexidade a rede pode aprender(cuidado com overfitting)
    // e consequentemente, mais processamento ela vai usar

    // A ReLU age como um filtro:
    // É como se ela deixasse somente os dados interessantes seguirem viagem na rede
    // Se a informação chegou nesse neuronio é positiva, passa para frente!
    // Se for zero ou negativa, pode jogar fora, nao vai servir para nada
    // A ReLU (Linear Retificada) é uma função de ativação que ajuda a rede a aprender padrões complexos, introduzindo não linearidade. Ela é definida como f(x) = max(0, x), ou seja, retorna 0 para valores negativos e o próprio valor para valores positivos. Isso permite que a rede capture relações não lineares entre as entradas e as saídas, melhorando a capacidade de aprendizado do modelo.
    model.add(tf.layers.dense({ inputShape: [7], units: 80, activation: 'relu' }))

    // Saída: 3 neuronios (premium, medium, basic)
    // A softmax é a função de ativação mais comum para a camada de saída em problemas de classificação multiclasse. Ela transforma os valores de saída da camada densa em probabilidades, garantindo que a soma das saídas seja igual a 1. Isso é útil para interpretar as saídas como probabilidades de cada classe, facilitando a tomada de decisão do modelo.
    model.add(tf.layers.dense({ units: 3, activation: 'softmax' }))

    // Compilando o modelo
    // optimizer Adam (Adaptive Moment Estimation) é um algoritmo de otimização que ajusta os pesos da rede neural durante o treinamento, combinando as vantagens de outros otimizadores como o AdaGrad e o RMSProp. Ele é eficiente para lidar com grandes conjuntos de dados e parâmetros, e é amplamente utilizado devido à sua capacidade de convergir rapidamente para uma solução ótima.
    // é um treinador pessoal moderno para redes neurais:
    // ajusta os pesos de forma eficiente e inteligentes
    // aprender com historico de erros e acertos

    // loss: categoricalCrossentropy é uma função de perda usada em problemas de classificação multiclasse. Ela mede a diferença entre as distribuições de probabilidade previstas pelo modelo e as distribuições reais (one-hot encoded). O objetivo do treinamento é minimizar essa perda, o que significa que o modelo está aprendendo a prever as classes corretas com maior precisão.
    // ele compara o que o modelo "acha" (os scores de cada categoria)
    // com a resposta certa
    // a categoria premium será sempre [1, 0, 0]

    // quanto mais distante da previsao do modelo da resposta correta
    // maior o erro (loss) e mais o modelo precisa aprender
    // Exemplo classico: classificação de imagens, recomendação, categorização de usuario
    // qualquer coisa em que a resposta certa é "apenas uma entre várias possíveis"
    model.compile({
        optimizer: 'adam',
        loss: 'categoricalCrossentropy',
        metrics: ['accuracy']
    })

    // Treinamento do modelo
    await model.fit(
        inputXs,
        outputYs,
        {
            verbose: 0, // 0 = sem logs, 1 = barra de progresso, 2 = uma linha por época
            epochs: 100, // número de vezes que o modelo vai passar por todo o dataset
            shuffle: true, // embaralha os dados a cada época para evitar padrões/viés/BIAS de aprendizado
            callbacks: {
                // onEpochEnd: (epoch, logs) => {
                //     console.log(`Epoch ${epoch}: loss = ${logs.loss}, accuracy = ${logs.acc}`);
                // }
            }
        }
    )

    return model
}

async function predict(model, pessoa) {
    // transformar o array js para o tensor (tfjs)
    const tfInput = tf.tensor2d(pessoa)

    // Faz a predição (output será um vetor de 3 probabilidades)
    const pred = model.predict(tfInput)
    const predArray = await pred.array()

    return predArray[0].map((prob, index) => ({prob, index}))
}

// Exemplo de pessoas para treino (cada pessoa com idade, cor e localização)
// const pessoas = [
//     { nome: "Erick", idade: 30, cor: "azul", localizacao: "São Paulo" },
//     { nome: "Ana", idade: 25, cor: "vermelho", localizacao: "Rio" },
//     { nome: "Carlos", idade: 40, cor: "verde", localizacao: "Curitiba" }
// ];

// Vetores de entrada com valores já normalizados e one-hot encoded
// Ordem: [idade_normalizada, azul, vermelho, verde, São Paulo, Rio, Curitiba]
// const tensorPessoas = [
//     [0.33, 1, 0, 0, 1, 0, 0], // Erick
//     [0, 0, 1, 0, 0, 1, 0],    // Ana
//     [1, 0, 0, 1, 0, 0, 1]     // Carlos
// ]

// Usamos apenas os dados numéricos, como a rede neural só entende números.
// tensorPessoasNormalizado corresponde ao dataset de entrada do modelo.
const tensorPessoasNormalizado = [
    [0.33, 1, 0, 0, 1, 0, 0], // Erick
    [0, 0, 1, 0, 0, 1, 0],    // Ana
    [1, 0, 0, 1, 0, 0, 1]     // Carlos
]

// Labels das categorias a serem previstas (one-hot encoded)
// [premium, medium, basic]
const labelsNomes = ["premium", "medium", "basic"]; // Ordem dos labels
const tensorLabels = [
    [1, 0, 0], // premium - Erick
    [0, 1, 0], // medium - Ana
    [0, 0, 1]  // basic - Carlos
];

// Criamos tensores de entrada (xs) e saída (ys) para treinar o modelo
const inputXs = tf.tensor2d(tensorPessoasNormalizado)
const outputYs = tf.tensor2d(tensorLabels)

inputXs.print();
outputYs.print();

// quanto mais dado melhor!
// assim o algoritmo consegue entender melhor os padrões complexos dos dados
const model = await trainModel(inputXs, outputYs);
console.log('Treinamento concluido.');

const pessoa = { nome: "zé", idade: 28, cor: "verde", localizacao: "Curitiba" }
// Normalizando a idade da nova pessoal usando o mesmo padrão do treino
// Exemplo: idade_min = 25, idade_max = 40, então (28 - 25) / (40 - 25) = 0.2

const pessoaTensorNormalizado = [
    [
        0.2, // idade normalizada
        0, // cor azul
        0, // cor vermelho
        1, // cor verde
        0, // localização São Paulo
        0, // localização Rio
        1  // localização Curitiba
    ]
]

const predictions = await predict(model, pessoaTensorNormalizado)
const results = predictions
    .sort((a, b) => b.prob - a.prob) // ordena da maior para a menor probabilidade
    .map(p => `${labelsNomes[p.index]}: ${(p.prob * 100).toFixed(2)}%`) // formata a saída
    .join('\n') // junta tudo em uma string com quebras de linha

console.log(results)