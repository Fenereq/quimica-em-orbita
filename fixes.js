/* Reliability fixes for tile resolution, question feedback and dice randomization. */
(function () {
  function randomDieValue() {
    if (window.crypto && window.crypto.getRandomValues) {
      const values = new Uint32Array(1);
      window.crypto.getRandomValues(values);
      return (values[0] % 6) + 1;
    }
    return Math.floor(Math.random() * 6) + 1;
  }

  async function animateDie(finalValue) {
    for (let i = 0; i < 8; i += 1) {
      $('die').textContent = randomDieValue();
      await sleep(65);
    }
    $('die').textContent = finalValue;
    await sleep(140);
  }

  function openQuestion() {
    if (!game.deck.length) {
      show('Banco esgotado', 'Todas as perguntas desta partida já foram usadas. Nenhuma será repetida.', 'Encerrar vez', finishTurn);
      return;
    }
    const id = game.deck.shift();
    const question = questions[id];
    game.used.push(id);
    $('modalTag').textContent = `PERGUNTA · ${question[3].toUpperCase()}`;
    $('modalTitle').textContent = question[0];
    $('modalText').textContent = 'Escolha uma alternativa:';
    $('answers').innerHTML = question[1].map((answer, index) => `<button class="answer" data-answer="${index}">${String.fromCharCode(65 + index)}) ${answer}</button>`).join('');
    $('modalContinue').hidden = true;
    $('modal').hidden = false;

    document.querySelectorAll('.answer').forEach((button) => {
      button.onclick = () => {
        const selected = Number(button.dataset.answer);
        const correct = selected === question[2];
        document.querySelectorAll('.answer').forEach((answerButton, index) => {
          answerButton.disabled = true;
          answerButton.classList.toggle('correct', index === question[2]);
          answerButton.classList.toggle('wrong', index === selected && !correct);
        });
        if (correct) {
          const points = question[3] === 'fácil' ? 1 : question[3] === 'média' ? 2 : 3;
          game.players[game.current].score += points;
          $('modalText').textContent = `Correto! Você ganhou ${points} ponto(s).`;
          say('Correto. Estou quase impressionado.');
        } else {
          $('modalText').textContent = `Não foi dessa vez. Resposta correta: ${question[1][question[2]]}.`;
          say('Errado. Fascinante.');
        }
        $('modalContinue').textContent = 'Voltar ao tabuleiro';
        $('modalContinue').hidden = false;
        $('modalContinue').onclick = () => {
          hide();
          finishTurn();
        };
      };
    });
  }

  async function resolveTile(skipReroll) {
    const player = game.players[game.current];
    const effect = special[player.position];
    if (player.position === 50) {
      show('Vitória!', `${player.name} chegou à casa 50 com ${player.score} pontos!`, 'Nova partida', () => { hide(); start(); });
      say('Contra todas as expectativas, você sobreviveu.');
      game.busy = false;
      render();
      return;
    }
    if (!effect) {
      openQuestion();
      return;
    }
    if (effect === 'rerollForward' || effect === 'rerollBack') {
      if (skipReroll) {
        await finishTurn();
        return;
      }
      const direction = effect === 'rerollForward' ? 1 : -1;
      const explanation = direction === 1 ? 'Impulso de reação: lance novamente e avance.' : 'Reação reversa: lance novamente e recue.';
      show('Jogue novamente', explanation, 'Lançar dado extra', async () => {
        hide();
        const extra = randomDieValue();
        await animateDie(extra);
        await move(extra, direction);
        await resolveTile(true);
      });
      return;
    }
    if (effect === 'pipette') {
      const destination = player.position === 14 ? 37 : 14;
      show('Pipeta gigante', `A pipeta transporta ${player.name} para a casa ${destination}.`, 'Transportar', async () => {
        player.position = destination;
        render();
        hide();
        await finishTurn();
      });
      return;
    }
    if (effect === 'portalHome' || effect === 'portalPipette') {
      const destination = effect === 'portalHome' ? 1 : 37;
      show('Teleporte atômico', `Destino confirmado: casa ${destination}.`, 'Teletransportar', async () => {
        player.position = destination;
        render();
        hide();
        await finishTurn();
      });
      return;
    }
    const events = [
      ['Faísca controlada', 'Avance 2 casas.', 2, 0],
      ['Anotação brilhante', 'Ganhe 1 ponto.', 0, 1],
      ['Vazamento de espuma', 'Recue 2 casas.', -2, 0]
    ];
    const event = events[Math.floor(Math.random() * events.length)];
    show('Evento relâmpago', `${event[0]} ${event[1]}`, 'Aplicar', async () => {
      player.score += event[3];
      if (event[2]) await move(Math.abs(event[2]), Math.sign(event[2]));
      hide();
      await finishTurn();
    });
  }

  window.fixedRoll = async function fixedRoll() {
    if (!game || game.busy) return;
    game.busy = true;
    render();
    const result = randomDieValue();
    await animateDie(result);
    say(`${game.players[game.current].name} tirou ${result}. Vamos ver o estrago.`);
    await move(result);
    await resolveTile(false);
    save();
  };

  $('rollButton').onclick = window.fixedRoll;
}());
