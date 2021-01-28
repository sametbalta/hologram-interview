import React, { useEffect, useState } from 'react';

import {
  View,
  SafeAreaView,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Button,
  Image
} from 'react-native';

import { Overlay, Icon } from 'react-native-elements';

import Constants from 'expo-constants';

import moment from 'moment';

import PureChart from 'react-native-pure-chart';

import getCountryISO2 from 'country-iso-3-to-2';

export default function App() {
  const activeButton = {backgroundColor: '#51C2D5', color: 'white'};
  const passiveButton = {backgroundColor: '#ffffff', color: 'black'};

  const [dataByDate, setDataByDate] = useState({});
  const [listData, setListData] = useState([]);
  const [selectedField, setSelectedField] = useState('total_vaccinations_per_hundred');
  const [chartData, setChartData] = useState([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedItem, setSelectedItem] = useState({});
  const [buttonOneStyle, setButtonOneStyle] = useState(activeButton);
  const [buttonTwoStyle, setButtonTwoStyle] = useState(passiveButton);

  const colorPalette = ['#6930c3', '#a2d0c1', '#726a95', '#ec4646', '#51c2d5', '#a98b98', '#a6f0c6', '#eb596e',
    '#23689b', '#f8dc81'];

  useEffect(() => {
    getData();
  }, []);

  /*
     It returns list data for a certain number of country. Top countries will be determined by the latest day's data
     with descending order.
   */
  const getListData = (data, field, limit = 10) => {
    if (field === 'total_vaccinations_per_hundred') {
      setButtonOneStyle(activeButton);
      setButtonTwoStyle(passiveButton);
    } else {
      setButtonOneStyle(passiveButton);
      setButtonTwoStyle(activeButton);
    }

    const today = moment().format('YYYY-MM-DD');
    let dateData = data[today];

    if (!dateData) {
      // In case of today's data is missing
      const yesterday = moment().subtract(1, 'days').format('YYYY-MM-DD');
      dateData = data[yesterday];
    }

    let values = Object.values(dateData);

    values.sort((b, a) => (a[field] > b[field]) ? 1 : ((b[field] > a[field]) ? -1 : 0));

    let listData = values.slice(0, limit);

    let i = 0;

    listData.map(function (d) {
      d.color = colorPalette[i % 10];
      i++;
    });

    return listData;
  };

  /*
     It returns chart data for a certain number of days from today to back. Top nth country will be determined by latest
     day's data.
   */
  const getChartData = (data, field, isoCodes, limit = 5) => {
    let chartData = [];
    let days = [];

    let i = 0;
    while (days.length < limit) {
      const dayString = moment().subtract(i++, 'days').format('YYYY-MM-DD');
      if (data[dayString]) {
        days.push(dayString);
      }
    }

    i = 0;
    isoCodes.map(function (isoCode) {
      let countryData = {
        seriesName: isoCode,
        data: [],
        color: colorPalette[i % 5]
      };

      days.map(function (day) {
        countryData.data.push({
          x: day,
          y: data[day][isoCode][field]
        })
      });

      i++;

      chartData.push(countryData);
    });

    return chartData;
  };

  /*

  It parses raw csv string data and converts to json. Days are used ay key. Country codes are used at second level.

  Sample data format:

  {
    "2020-01-21": {
      "TUR": {...},
      "GER": {...}
    },
    "2020-01-20": {
      "TUR": {...},
      "GER": {...}
    }
  }

   */
  const prepareData = (csv) => {
    let lines = csv.split('\n');

    let byDate = {};

    let headers = lines[0].split(',');

    for (let i = 1; i < lines.length; i++) {
      let obj = {};
      let currentLine = lines[i].split(',');

      for (let j = 0; j < headers.length; j++) {
        obj[headers[j]] = currentLine[j];
      }

      // Exclude World's total data
      if (obj.iso_code === 'OWID_WRL') {
        continue;
      }

      if (!obj.total_vaccinations || obj.total_vaccinations === '') {
        obj.total_vaccinations = '0';
      }

      if (!obj.total_vaccinations_per_hundred || obj.total_vaccinations_per_hundred === '') {
        obj.total_vaccinations_per_hundred = '0';
      }

      // Some fields were "String". We need to parse values in order to sort data or show values properly.
      obj.population = parseInt(obj.population);
      obj.new_vaccinations = parseInt(obj.new_vaccinations);
      obj.total_vaccinations = parseInt(obj.total_vaccinations);
      obj.total_vaccinations_per_hundred = parseFloat(obj.total_vaccinations_per_hundred);

      /*
       We can show country flags without any installation thanks to www.countryflags.io. Additionally, we have to
       convert 3 digits country code into 2 digits.
       */
      obj.flag = 'https://www.countryflags.io/' + getCountryISO2(obj.iso_code) + '/flat/64.png';

      obj.id = i + '';

      if (!byDate[obj.date]) {
        byDate[obj.date] = {};
      }

      byDate[obj.date][obj.iso_code] = obj;
    }

    setDataByDate(byDate);

    // Set initial data
    let listData = getListData(byDate, selectedField);
    let isoCodes = listData.map(a => a.iso_code);
    setListData(listData);
    setChartData(getChartData(byDate, selectedField, isoCodes));

    setIsLoaded(true);
  };

  /*
  It gets recent data from ourworldindata.org
   */
  const getData = () => {
    fetch('https://covid.ourworldindata.org/data/owid-covid-data.csv')
        .then((response) => response.text())
        .then((v) => prepareData(v))
        .catch((err) => console.log(err));
  };

  // On change comparison data.
  const onSelectedFieldChange = (fieldName) => {
    setSelectedField(fieldName);

    let listData = getListData(dataByDate, fieldName);
    let isoCodes = listData.map(a => a.iso_code);
    setListData(listData);
    setChartData(getChartData(dataByDate, fieldName, isoCodes));
  };

  // Format values by field types
  const getValue = (item, field) => {
    if (!field) {
      field = selectedField;
    }

    if (!item || !item[field]) {
      return '-';
    }

    switch (field) {
      case 'total_vaccinations_per_hundred':
        return item[field] + '%';
      default:
        return item[field].toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    }
  };

  const ListItem = ({ item, index }) => (
      <TouchableOpacity style={[styles.item, index % 2 === 0 ? styles.even : {}]}
                        onPress={() => {
                          setSelectedItem(item);
                          setModalVisible(true);
                        }}>
        <View style={[styles.circle, {backgroundColor: item.color}]} />
        <Text style={styles.itemLocation}>{item.location}</Text>
        <Image
            source={{
              uri: item.flag,
            }}
            style={{width: 20, height: 20, marginTop: 5}}
        />
        <Text style={styles.itemValue}>{getValue(item)}</Text>
      </TouchableOpacity>
  );

  const renderListItem = ({ item, index }) => (
      <ListItem item={item} index={index} />
  );

  return (
      <SafeAreaView style={styles.container}>
        {
          !isLoaded &&
          <View style={styles.indicator}>
            <ActivityIndicator size="large" color="#23689b" />
            <Text style={styles.indicatorText}>Fetching Data...</Text>
          </View>
        }
        {
          isLoaded &&
          <View style={{ flex: 1}}>
            <Text style={styles.title}>Coronavirus Pandemic Data Explorer</Text>

            <View style={styles.lineChart}>
              <PureChart data={chartData} type='line' />
            </View>

            <View style={styles.dataButtons}>
              <TouchableOpacity
                  style={[
                    styles.dataButton,
                    { backgroundColor: buttonOneStyle.backgroundColor },
                  ]}
                  onPress={() => {
                    onSelectedFieldChange('total_vaccinations_per_hundred')
                  }}>
                <Text style={{ color: buttonOneStyle.color }}>Per Hundred</Text>
              </TouchableOpacity>


              <TouchableOpacity
                  style={[
                    styles.dataButton,
                    { backgroundColor: buttonTwoStyle.backgroundColor },
                  ]}
                  onPress={() => {
                    onSelectedFieldChange('total_vaccinations')
                  }}>
                <Text style={{ color: buttonTwoStyle.color, justifyContent: 'center' }}>Total Vaccinations</Text>
              </TouchableOpacity>
            </View>

            <FlatList
                style={{ marginTop: 40 }}
                data={listData}
                renderItem={renderListItem}
                keyExtractor={(item) => item.id}
            />

            <Overlay isVisible={modalVisible}
                     onBackdropPress = {() => {
                       setModalVisible(false);
                     }}>

              <View>
                <View style={styles.modalItem}>
                  <Text style={styles.modalTitle}>{ selectedItem.location }</Text>
                  <Image
                      source={{
                        uri: selectedItem.flag,
                      }}
                      style={{width: 64, height: 64}}
                  />
                </View>

                <View style={styles.modalItem}>
                  <Icon raised name='users' type='font-awesome' color='#23689b' />
                  <Text>Population</Text>
                  <Text style={styles.modalItemValue}>{ getValue(selectedItem, 'population') }</Text>
                </View>

                <View style={styles.modalItem}>
                  <Icon raised name='shield' type='font-awesome' color='#23689b' />
                  <Text>Total vaccinations</Text>
                  <Text style={styles.modalItemValue}>{ getValue(selectedItem, 'total_vaccinations') }</Text>
                </View>

                <View style={styles.modalItem}>
                  <Icon raised name='thumbs-o-up' type='font-awesome' color='#23689b' />
                  <Text>Total vaccinations per hundred</Text>
                  <Text style={styles.modalItemValue}>{ getValue(selectedItem, 'total_vaccinations_per_hundred') }</Text>
                </View>

                <View>
                  <Button
                      onPress={() => {
                        setModalVisible(!modalVisible);
                      }}
                      title="Close"
                  />
                </View>
              </View>
            </Overlay>

          </View>
        }
      </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    paddingTop: Constants.statusBarHeight,
    padding: 8,
  },
  title: {
    margin: 24,
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  item: {
    paddingTop: 10,
    paddingBottom: 10,
    paddingLeft: 5,
    paddingRight: 5,
    marginVertical: 0,
    marginHorizontal: 0,
    flex: 1,
    alignSelf: 'stretch',
    flexDirection: 'row'
  },
  itemLocation: {
    margin: 5,
    fontSize: 12,
    fontWeight: 'bold',
    textAlign: 'left',
    flex: 1,
    alignSelf: 'stretch'
  },
  itemValue: {
    margin: 5,
    fontSize: 12,
    textAlign: 'right',
    flex: 1,
    alignSelf: 'stretch'
  },
  even: {
    backgroundColor: '#eeeeee',
  },
  circle: {
    width: 14,
    height: 14,
    alignSelf: 'stretch',
    marginTop: 7,
    marginLeft: 5,
    marginBottom: 5,
    marginRight: 0,
    borderRadius: 100 / 2
  },
  indicator: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    lineHeight: 50
  },
  indicatorText: {
    marginTop: 20,
    fontSize: 20,
    color: '#23689b'
  },
  lineChart: {
    alignSelf: 'center'
  },
  modalTitle: {
    marginBottom: 15,
    fontSize: 24,
    alignSelf: 'center',
    fontWeight: 'bold',
    textTransform: 'uppercase'
  },
  modalItem: {
    alignItems: 'center',
    marginBottom: 20
  },
  modalItemValue: {
    fontSize: 22,
    fontWeight: 'bold'
  },
  dataButtons: {
    flex: 1,
    flexDirection: 'row',
    alignContent: 'stretch',
    height: 50,
    marginTop: 20
  },
  dataButton: {
    flex: 1,
    height: 40,
    alignItems: 'center',
    paddingTop: 10
  }
});
