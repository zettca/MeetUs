function submite() {
  console.log(title.value);
  console.log(description.value);
  console.log(duration.value);
  console.log(tod.value);

  const xhttp = new XMLHttpRequest();
  xhttp.onreadystatechange = function () {
    if (this.readyState == 4 && this.status == 200) {
      console.log(this.responseText);
      const jsonResult = JSON.parse(this.responseText);
      const code = jsonResult.event;
      document.getElementById("meetingURL").innerHTML = "http://localhost:8080/meeting.html?code=" + code;
    }
  };
  xhttp.open(
    "GET",
    `/create?title=${title.value}&description=${description.value}&duration=${duration.value}&tod=${tod.value}`,
    true);
  xhttp.send();
}