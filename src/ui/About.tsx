import { getLang } from '../i18n/index.ts';
import { Modal } from './Modal.tsx';

const REPO = 'https://github.com/yinon-mitin/family-studio';

export function About({ onClose }: { onClose(): void }) {
  const en = getLang() === 'en';
  return (
    <Modal title={en ? 'About the site' : 'О сайте'} onClose={onClose} wide>
      {en ? <AboutEn /> : <AboutRu />}
    </Modal>
  );
}

function AboutRu() {
  return (
    <>
      <h3>Для чего это</h3>
      <p>
        «Герб семьи» помогает подумать о семье через образы: чем она занимается, какая у неё сила, на что она опирается и что хочется передать дальше.
        Это инструмент для размышления и разговора в группе, а не тест. Значения символов и цветов — возможные ассоциации; у каждого свои.
        Что значит символ для вас, решаете только вы.
      </p>
      <h3>Как провести практику (для ведущего)</h3>
      <ol>
        <li>Участники выбирают форму щита и цвета, думая о том, что для семьи защита и что значит дом.</li>
        <li>Добавляют 3–5 символов: сферы работы, животное, природу, ценность. Открытые вопросы есть на каждой вкладке, отвечать на них необязательно.</li>
        <li>К каждому элементу по желанию пишут, почему он выбран: заметка попадёт во вторую часть PDF.</li>
        <li>По желанию делятся гербом в группе. Ведущий напоминает, что никто не обязан объяснять выбор.</li>
        <li>В конце участники скачивают герб или стирают данные с общего компьютера кнопкой «Стереть мои данные».</li>
      </ol>
      <p>Вопросы сформулированы так, чтобы подходить любой семье: полной, неполной, новой, приёмной, избранной.</p>
      <h3>Приватность</h3>
      <p>
        Всё, что вы создаёте и пишете в заметках, остаётся в вашем браузере. Сайт ничего не отправляет на сервер, не использует аналитику и внешние шрифты.
        Герб сохраняется на этом устройстве автоматически; на общем компьютере используйте «Стереть мои данные» (в меню «Файл»).
      </p>
      <h3>Авторы материалов</h3>
      <ul>
        <li>
          Значки — <a href="https://game-icons.net" target="_blank" rel="noopener">game-icons.net</a>, авторы Lorc, Delapouite, Skoll, Willdabeast, Lord Berandas и другие,
          лицензия <a href="https://creativecommons.org/licenses/by/3.0/" target="_blank" rel="noopener">CC BY 3.0</a>. Значки выбраны и изменены по цвету.
        </li>
        <li>Шрифты PT Serif и Cormorant — лицензия SIL OFL 1.1.</li>
        <li>
          Код сайта — лицензия MIT, <a href={REPO} target="_blank" rel="noopener">исходный код на GitHub</a>.
        </li>
      </ul>
    </>
  );
}

function AboutEn() {
  return (
    <>
      <h3>What it is for</h3>
      <p>
        "Family crest" helps you think about a family through images: what it does, where its strength lies, what it rests on and what you want to pass on.
        It is a tool for reflection and conversation in a group, not a test. The meanings of symbols and colors are possible associations; everyone has their own.
        What a symbol means to you is for you alone to decide.
      </p>
      <h3>How to run the practice (for facilitators)</h3>
      <ol>
        <li>Participants choose a shield shape and colors, thinking about what protection means for the family and what home means.</li>
        <li>They add 3–5 symbols: lines of work, an animal, nature, a value. Open questions are on every tab; answering them is optional.</li>
        <li>If they wish, they write why each element was chosen: the note goes into the second part of the PDF.</li>
        <li>If they wish, they share the crest with the group. The facilitator reminds everyone that nobody has to explain their choices.</li>
        <li>At the end participants download the crest or erase their data from a shared computer with the "Erase my data" button.</li>
      </ol>
      <p>The questions are worded to suit any family: whole, single-parent, new, adoptive, chosen.</p>
      <h3>Privacy</h3>
      <p>
        Everything you create and write in the notes stays in your browser. The site sends nothing to a server and uses no analytics or external fonts.
        The crest is saved on this device automatically; on a shared computer use "Erase my data" (in the "File" menu).
      </p>
      <h3>Credits</h3>
      <ul>
        <li>
          Icons: <a href="https://game-icons.net" target="_blank" rel="noopener">game-icons.net</a>, by Lorc, Delapouite, Skoll, Willdabeast, Lord Berandas and others,
          licensed <a href="https://creativecommons.org/licenses/by/3.0/" target="_blank" rel="noopener">CC BY 3.0</a>. The icons were selected and recolored.
        </li>
        <li>PT Serif and Cormorant fonts: SIL OFL 1.1 license.</li>
        <li>
          The site's code is MIT licensed, <a href={REPO} target="_blank" rel="noopener">source code on GitHub</a>.
        </li>
      </ul>
    </>
  );
}
