const zodiac = [
  "원숭이", "닭", "개", "돼지", "쥐", "소", "호랑이", "토끼", "용", "뱀", "말", "양"
];

const elements = ["목", "화", "토", "금", "수"];

function getElement(year) {
  return elements[year % 5];
}

function getHourBranch(time) {
  const [h] = time.split(":").map(Number);
  const branches = ["자", "축", "인", "묘", "진", "사", "오", "미", "신", "유", "술", "해"];
  return branches[Math.floor(((h + 1) % 24) / 2)];
}

function buildMessage({ name, gender, date, time, place, calendar }) {
  const year = new Date(date).getFullYear();
  const animal = zodiac[year % 12];
  const element = getElement(year);
  const hourBranch = getHourBranch(time);

  return `
    <h2 class="result-title">${name}님의 사주 성향 리포트</h2>
    <ul class="result-list">
      <li><strong>기본 정보:</strong> ${gender} / ${calendar} / ${place} 출생</li>
      <li><strong>띠 성향:</strong> ${animal}띠의 추진력과 현실 감각이 강하게 드러납니다.</li>
      <li><strong>오행 포인트:</strong> <strong>${element}</strong> 기운이 중심이라 성실함과 균형 감각이 장점입니다.</li>
      <li><strong>시간대 해석(${hourBranch}시):</strong> 한 번 집중하면 깊게 파고드는 타입입니다.</li>
      <li><strong>한 줄 조언:</strong> 올해는 인간관계에서 먼저 제안할수록 좋은 기회가 커집니다.</li>
    </ul>
    <p class="muted">※ 본 결과는 데모용 간이 해석입니다. 실제 사주 명식 계산 로직(천간/지지/절기 보정 등)은 추가 구현이 필요합니다.</p>
  `;
}

const form = document.getElementById("fortune-form");
const result = document.getElementById("result");

form.addEventListener("submit", (event) => {
  event.preventDefault();

  const payload = {
    name: document.getElementById("name").value.trim(),
    gender: document.getElementById("gender").value,
    date: document.getElementById("birth-date").value,
    time: document.getElementById("birth-time").value,
    place: document.getElementById("birth-place").value.trim(),
    calendar: document.getElementById("calendar").value,
  };

  result.innerHTML = buildMessage(payload);
  result.classList.remove("hidden");
  result.scrollIntoView({ behavior: "smooth", block: "start" });
});
