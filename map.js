jQuery(document).ready(function($){
  ymaps.ready(init);
  function init() {
    var center = [59.939095, 30.315868];
    var myMap = new ymaps.Map('map', {
      center: [59.939095, 30.315868],
      zoom: 8
    });

    var searchControl = new ymaps.control.SearchControl({
      options: {
        noPlacemark: true
      }
    });

    var objectManager = new ymaps.ObjectManager({
      clusterize: true,
      clusterHasBalloon: true,
    });

    var clusterer = new ymaps.Clusterer({
      clusterIcons: [{
        size: [32, 32],
        offset: [-16, -16]
      }],
      clusterIconContentLayout: null,
      clusterBalloonPanelMaxMapArea: 0,
      clusterBalloonOffset: [0, 0],
      clusterBalloonMinHeight: 150,
      gridSize: 128
    });

    objectManager.objects.options.set({
      preset: 'map_info'
    });

    // Добавляем обработчик события objects.add для objectManager
    objectManager.events.add('objectsadd', function() {
      updateMarkersList(objectManager, center);
    });

    myMap.geoObjects.add(objectManager);

    $.ajax({
    url: '../map/data.json',
    dataType: 'json',
    success: function(data) {
      objectManager.add(data);
    }
  });

    myMap.options.set('maxZoom', 16);

    // Добавляем обработчик события boundschange к карте
    myMap.events.add('boundschange', function(e) {
      // Обновляем список меток на основе текущей области отображения карты, сортируя их по расстоянию до центра карты
      updateMarkersList(objectManager, e.get('newCenter'));
    });

  // Функция обновления списка меток, сортированных по близости к центру карты
  function updateMarkersList(objectManager, center) {
    var markersList = document.getElementById('markers-container');
    markersList.innerHTML = '';

    var sortedObjects = [];

    objectManager.objects.each(function(obj) {
      var objectState = objectManager.getObjectState(obj.id);
      if (objectState.isShown) {
        var company = obj.properties.company;
        var city = obj.properties.locality;
        var address = obj.properties.address;
        var phone = obj.properties.phone;
        var coords = obj.geometry.coordinates;
        var id = obj.id;

        var distance = ymaps.coordSystem.geo.getDistance(center, coords);

        sortedObjects.push({
          distance: distance,
          markerItem: createMarkerItem(id, company, city, address, phone, coords)
        });
      }
    });

    // Сортируем метки по расстоянию от них до центра карты
    sortedObjects.sort(function(a, b) {
      return a.distance - b.distance;
    });

    sortedObjects.forEach(function(sortedObject) {
      markersList.appendChild(sortedObject.markerItem);
    });

    // Добавляем обработчик событий клика на каждую метку в списке
    var markerItems = document.querySelectorAll('.marker-item');

    markerItems.forEach(function(marker) {
      marker.addEventListener('click', function(event) {
        event.preventDefault();

        // Удаляем класс "active" у всех элементов списка
        markerItems.forEach(function(item) {
          item.classList.remove('active');
        });

        // Получаем id метки из data-атрибута
        var id = this.dataset.id;

        // Определяем объект метки и его свойства
        var markerObject = objectManager.objects.getById(id);
        if (!markerObject) {
          return; // Прекращаем выполнение функции, если объект не существует
        }

        // Открываем balloon метки по id
        objectManager.objects.balloon.open(id);

        // Добавляем класс "active" к выбранной метке
        this.classList.add('active');

        // Получаем координаты метки
        var coords = this.dataset.coords.split(',');
        var latitude = parseFloat(coords[0]);
        var longitude = parseFloat(coords[1]);

        // Получаем размеры балуна метки
        var balloonLayout = markerObject.properties._balloonLayout;
        if (!balloonLayout) {
          return; // Прекращаем выполнение функции, если балун не существует
        }
        var balloonSize = balloonLayout.getSize();

        // Центрируем карту с учетом размеров балуна
        myMap.setCenter([latitude, longitude], {
          duration: 500,
          checkZoomRange: true,
          viewport: {
            projection: myMap.options.get('projection'),
            center: [latitude, longitude + balloonSize[1] / 2], // Высоту балуна делим на 2 и добавляем к координате y
            zoom: myMap.setZoom(16),
            margin: [50, 50, 50, 50]
          }
        });
      });
    });
  }

  // Функция для создания элемента списка метки
  function createMarkerItem(id, company, city, address, phone, coords) {
      var markerItem = document.createElement('div');
      markerItem.innerHTML = '<div class="marker-item-company"><h3>' + company + '</h3></div><div class="marker-item-location">' + city + ', ' + address + '</div>' + '</h3></div><div class="marker-item-phone">' + phone + '</div>';
      markerItem.dataset.coords = coords.join(',');
      markerItem.classList.add('marker-item');
      markerItem.dataset.id = id;
      return markerItem;
  }

  BalloonLayout = ymaps.templateLayoutFactory.createClass(
    "<div class='my-hint'>" +
    '<div class="arrow"></div>' +
    '<a class="close" href="#"></a>' +
    "<div class='title'>{{ properties.company }}</div>" +
    "<p class='a_address'>г. {{ properties.locality }}, {{ properties.address }}</p>" +
    "<p class='a_phone'>тел.: {{ properties.phone }}</p>" +
    '<p><a href="{{ properties.site }}" target="_blank">{{ properties.site }}</a></p>'+
    "<ul class='partner_category'>" +
    '{% if properties.showroom == "YES" %}<li>шоурум</li>' +
    '{% else %} {% endif %}' +
    '{% if properties.salon == "YES" %}<li>кухонный салон</li>' +
    '{% else %} {% endif %}' +
    '{% if properties.santeh == "YES" %}<li>магазин сантехники</li>' +
    '{% else %} {% endif %}' +
    '{% if properties.webstore == "YES" %}<li>интернет-магазин</li>' +
    '{% else %} {% endif %}' +
    '</ul>' +
    "</div>" , {
      build: function () {
        this.constructor.superclass.build.call(this);
        this._$element = $('.my-hint', this.getParentElement());
        this.applyElementOffset();
        this._$element.find('.close')
          .on('click', $.proxy(this.onCloseClick, this));
      },

      clear: function () {
        this._$element.find('.close')
          .off('click');
        this.constructor.superclass.clear.call(this);
      },

      onSublayoutSizeChange: function () {
        BalloonLayout.superclass.onSublayoutSizeChange.apply(this, arguments);
        if(!this._isElement(this._$element)) {
          return;
        }
        this.applyElementOffset();
        this.events.fire('shapechange');
      },
      applyElementOffset: function () {
        this._$element.css({
          left: -(this._$element[0].offsetWidth / 2),
          top: -(this._$element[0].offsetHeight + this._$element.find('.arrow')[0].offsetHeight)
        });
      },
      onCloseClick: function (e) {
        e.preventDefault();
        this.events.fire('userclose');
      },
      getShape: function () {
        if(!this._isElement(this._$element)) {
          return BalloonLayout.superclass.getShape.call(this);
        }
        var position = this._$element.position();
        return new ymaps.shape.Rectangle(new ymaps.geometry.pixel.Rectangle([
          [position.left, position.top],
          [position.left + this._$element[0].offsetWidth,
          position.top + this._$element[0].offsetHeight + this._$element.find('.arrow')[0].offsetHeight]
        ]));
      },
      _isElement: function (element) {
        return element && element[0] && element.find('.arrow')[0];
      }
    }
  );

  ymaps.option.presetStorage.add('map_info', {
    balloonLayout: BalloonLayout,
    balloonPanelMaxMapArea: 0,
    hideIconOnBalloonOpen: true,
    balloonOffset: [0, 0]
  });

  // определение состояния выбранных категорий
  var showroomChecked = false;
  var webstoreChecked = false;
  var salonChecked = false;
  var santehChecked = false;

  // добавление обработчиков кликов на чекбоксы
  $('#showroom').on('click', function() {
    showroomChecked = $(this).is(':checked');
    filterObjects();
  });

  $('#webstore').on('click', function() {
    webstoreChecked = $(this).is(':checked');
    filterObjects();
  });

  $('#salon').on('click', function() {
    salonChecked = $(this).is(':checked');
    filterObjects();
  });

  $('#santeh').on('click', function() {
    santehChecked = $(this).is(':checked');
    filterObjects();
  });

  // функция фильтрации объектов
   function filterObjects() {
     objectManager.setFilter(function (object) {
       var properties = object.properties;

       if (!showroomChecked && !webstoreChecked && !salonChecked && !santehChecked) {
         // Если не отмечен ни один чекбокс, выводим все метки
         return true;
       }

       if (showroomChecked && properties.showroom === 'YES') {
         return true;
       }

       if (webstoreChecked && properties.webstore === 'YES') {
         return true;
       }

       if (salonChecked && properties.salon === 'YES') {
         return true;
       }

       if (santehChecked && properties.santeh === 'YES') {
         return true;
       }

       return false;
     });
   }
}

});
