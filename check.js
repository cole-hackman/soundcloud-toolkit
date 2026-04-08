async function run() {
  const res = await fetch("https://developers.soundcloud.com/docs/api/explorer/open-api");
  const text = await res.text();
  const matches = text.match(/https?:\/\/[^\s"'\\>]+?\.(json|yaml)/g);
  console.log("Matches:", matches);
}
run();
