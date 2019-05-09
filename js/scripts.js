(function () {
  
  // this is added as prefix to the id of the spinner span
  var BUTTON_SPINNER_ID_PREFIX = 'spinner-';

  var bookRepository = (function () {

    // this contains all of the books
    var repository = [];
     
    // properties of a valid object in the repository
    var requiredProperties = ['title', 'lastEditionKey', 'authors'];

    function validate(book) {

      // validate the input as an object with the same properties
      // as the ones in the repository

      var result = false;
      var properties = Object.keys(book);      
      var result = (typeof book === 'object')
                && (requiredProperties.length === properties.length)
                && requiredProperties.every(function(property) { return properties.indexOf(property) >= 0; });
                
      return result;      
    }

    function add(book) {
      // add a new book if it's a valid one
      if (validate(book)) {
        repository.push(book);
      } else {
        console.error("Error: you are trying to add a non valid object to the repository");
      }
    }
  
    function getAll() {
      // return the whole repository
      return repository;
    }

    function filter(title) {

      // return the books with the specified title

      function filterByTitle(book) {
        return book.title === title;
      }      
      
      return repository.filter(filterByTitle);
    }

    function _getURLParameter(name) {
        // https://stackoverflow.com/questions/1403888/get-escaped-url-parameter
        return decodeURIComponent((new RegExp('[?|&]' + name + '=' + '([^&;]+?)(&|#|;|$)').exec(location.search)||[,""])[1].replace(/\+/g, '%20'))||null;
    }
    
    function searchBooks(searchQuery, limit=10) {
      // escape the search term for URL usage
      var escapedSearchQuery = encodeURIComponent(searchQuery);
      var apiUrl = `https://openlibrary.org/search.json?q=${escapedSearchQuery}&limit=${limit}`;
      return fetch(apiUrl)
        .then(function (response) {
          // this returns a promise
          return response.json();
        })
        .then(function(json) {
          json.docs.forEach(function(item) {
            var book = {
              title: item.title,
              lastEditionKey: item.edition_key[item.edition_key.length - 1],
              authors: item.author_name
            };
            add(book);
          });
        })
        .catch(function (e) {
          console.error(e);
        });
    }

    function loadDetails(book) {
      var url = `https://openlibrary.org/api/books.json?bibkeys=${book.lastEditionKey}`;

      return $.ajax(url, { dataType: 'json' })
        .done(function (response) {
          // Now we add the details to the item
          book.thumbnailUrl = response[book.lastEditionKey].thumbnail_url;
          book.previewUrl = response[book.lastEditionKey].preview_url;
        })
        .fail(function (e) {
          console.error(e);
        });
    }

    function clear() {
      repository = [];
    }

    // exposed public functions
    return {
      add: add,
      getAll: getAll,
      filter: filter,
      searchBooks: searchBooks,
      loadDetails: loadDetails,
      clear: clear
    };
  })(); // end of bookRepository
  

  var modalDetails = (function () {

    var $modalContainer = $('#modal-container');

    function show({title, authors, thumbnailUrl, previewUrl}) {
      // Clear all existing modal content
      $modalContainer.empty();
    
      var $modal = $('<div class="modal"></div>');
    
      // add the new modal content

      var $closeButtonElement = $('<button class="modal-close">Close</button>');
      // add event listener to close the modal
      $closeButtonElement.on('click', hide);
      $modal.append($closeButtonElement);
      
      var $titleElement = $(`<h1>${title}</h1>`);
      $modal.append($titleElement);
      
      if (thumbnailUrl) {
        thumbnailUrl = thumbnailUrl.replace('-S.jpg', '-M.jpg');
      } else {
        thumbnailUrl = 'img/no-image.jpg';
      }
      var $imageElement = $(`<img src="${thumbnailUrl}" alt="${title}">`);
      $modal.append($imageElement);
      
      if (authors) {
        // useless filter attempt, as there are many 'null null' or 'john null' in
        // their database
        authors = authors.filter( (a) => a.toLowerCase() != 'null').join(', ');
        var $contentElement = $(`<p>Author(s): ${authors}</p>`);
        $modal.append($contentElement);
      }
    
      $modalContainer.append($modal);
    
      $modalContainer.on('click', (e) => {
        // Since this is also triggered when clicking INSIDE the modal
        // We only want to close if the user clicks directly on the overlay
        var $target = $(e.target);
        if ($target.is($modalContainer)) {
          hide();
        }
      });
      
      $modalContainer.addClass('is-visible');
    }
    
    function hide() {
      $modalContainer.removeClass('is-visible');
    }

    function isVisible() {
      return $modalContainer.hasClass('is-visible');
    }

    // exposed public functions
    return {
      show: show,
      hide: hide,
      isVisible: isVisible
    };
  })(); // end of modalDetails
  

  function showLoadingMessage($listSpinnerSpan) {
    $listSpinnerSpan.addClass('list-spinner');
  }

  function hideLoadingMessage($listSpinnerSpan) {
    $listSpinnerSpan.removeClass('list-spinner');
  }

  function showButtonSpinner({lastEditionKey}) {
    var target_id = '#' + BUTTON_SPINNER_ID_PREFIX + lastEditionKey;
    var $spinnerSpan = $(target_id);
    if ($spinnerSpan) {
      $spinnerSpan.addClass('button-spinner');
    }
    return $spinnerSpan;
  }
  
  function hideButtonSpinner($spinnerSpan) {
    $spinnerSpan.removeClass('button-spinner');
  }

  function showDetails(book) {
    // show loading spinner in the button
    var $spinnerSpan = showButtonSpinner(book);
    // load details
    bookRepository.loadDetails(book)
      .done(function () {
        // show the modal of the details of the book
        modalDetails.show(book);
      })
      .always(function () {
        // hide loading spinner in the button
        hideButtonSpinner($spinnerSpan);
      });
  }

  function addListItem(book, $booksListContainer) {

    // create and append a book button to the specified <ul> element

    var { title, lastEditionKey } = book;

    // create main <li> element containing the button
    var $listItemElement = $('<li class="books-list__item"></li>');
        
    // button (the title of the book)
    var $bookInfoDetailsButton = $(`<button>${title}</button>`);
    // span for the spinner within the button
    var spinnerSpanId = BUTTON_SPINNER_ID_PREFIX + lastEditionKey;
    var $spinnerSpan = $(`<span id="${spinnerSpanId}"></span>`);    
    // add the span for the spinner
    $bookInfoDetailsButton.append($spinnerSpan);

    // appent the button to the <li> element
    $listItemElement.append($bookInfoDetailsButton);

    // appent the <li> element to the DOM, to the specified <ul>
    $booksListContainer.append($listItemElement);

    // add an event listener for the button, which was just appended to the DOM
    $bookInfoDetailsButton.on('click', function(event) {
      showDetails(book);
    });
  }

  function clearListItems($booksListContainer) {
    $booksListContainer.empty();
  }

  function searchBooks(searchQuery, $booksListContainer) {

    // clear the existing results
    clearListItems($booksListContainer);
    bookRepository.clear();

    // load the repository from the server to the repository
    bookRepository.searchBooks(searchQuery)
      .then(function() {
        // Now the data is loaded!
        
        // If there are any books and the list container
        // exists, go through all of them and append them to it        
        bookRepository.getAll().forEach(function(book) {
          // append each book to the specified <ul> element
          addListItem(book, $booksListContainer);
        });
      })
      .finally(function () {
        // hide list loading spinner
        hideLoadingMessage($listSpinnerDiv);
      });
  }

  // the the <ul> element where to append all the <li> elements
  // each representing a book card
  var $booksListContainer = $('.books-list');

  if ($booksListContainer) {
    // if the <ul> is existing, load the data from server and 
    // then populate the list with books from the repository

    // div for the spinner within the button
    var $listSpinnerDiv = $('<div></div>');
    // appent the div to the <ul>
    $listSpinnerDiv.insertBefore($booksListContainer);
    
    var $searchForm = $('#search-form');
    // add a submit listener to the form
    $searchForm.on('submit', (e) => {
      e.preventDefault(); // Do not submit to the server
  
      var searchQuery = $('#search-query').val();
      // start a search only if search term is not empty
      if (searchQuery.trim().length > 0) {
        // show list loading spinner
        showLoadingMessage($listSpinnerDiv);
        searchBooks(searchQuery, $booksListContainer);
      }
    })
  } // end if ($booksListContainer)
  
  $(window).on('keydown', (e) => {
    // if the user presses the ESC key the modal should be hidden if it is already not
    if (e.key === 'Escape' && modalDetails.isVisible()) {
      modalDetails.hide();
    }
  });
})();
