const noteList = document.querySelector('#notes .noteList');

let memos;

window.addEventListener('DOMContentLoaded', async () => {
    refreshMemoList();
});

setInterval(refreshMemoList, 3000);

async function refreshMemoList() {
    // Clear the list
    $('#notes .noteList .el').off('click');
    noteList.innerHTML = '';

    memos = await window.backend.memos.get(); // Fetch memos

    memos.forEach((memo, i) => {
        const memoDiv = document.createElement('div'); // Create the container div
        memoDiv.setAttribute('data-memo-index', i);
        memoDiv.classList.add('el'); // Add a class to the div

        const memoSpan = document.createElement('span'); // Create the span for the title
        memoSpan.textContent = memo.title; // Safely set the text content

        memoDiv.appendChild(memoSpan); // Append the span to the div
        noteList.appendChild(memoDiv); // Append the div to the note list
    });

    $('#notes .noteList .el').on('click', (e) => {
        const $el = $(e.target).closest('.el'); // Ensure we get the `.el` element
        const memoIndex = $el.data('memo-index'); // Read the `data-memo-index` from the `.el`
        const memo = memos[memoIndex];

        $('#noteTitle').text(memo.title);
        $('#noteContents').html(memo.content.replace(/(?:\r\n|\r|\n)/g, '<br>'));

        $('#notes .noteViewer').addClass('active');
    });
}