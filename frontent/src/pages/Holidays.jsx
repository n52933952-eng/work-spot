import { useState, useEffect } from 'react';
import {
  Box,
  Heading,
  Button,
  Table,
  TableContainer,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  Badge,
  Card,
  CardBody,
  HStack,
  VStack,
  Text,
  IconButton,
  useDisclosure,
  Spinner,
  Center,
  useToast,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalFooter,
  ModalBody,
  ModalCloseButton,
  FormControl,
  FormLabel,
  Input,
  Select,
  Textarea,
  Switch,
  SimpleGrid,
  Tabs,
  TabList,
  TabPanels,
  Tab,
  TabPanel,
  Icon
} from '@chakra-ui/react';
import { FiPlus, FiEdit2, FiTrash2, FiCalendar, FiList } from 'react-icons/fi';
import MainLayout from '../components/Layout/MainLayout';
import { holidaysAPI } from '../services/api';
import HolidayCalendar from '../components/HolidayCalendar';

const Holidays = () => {
  const [holidays, setHolidays] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedHoliday, setSelectedHoliday] = useState(null);
  const [filterYear, setFilterYear] = useState(new Date().getFullYear());
  const [filterType, setFilterType] = useState('');
  
  const { isOpen, onOpen, onClose } = useDisclosure();
  const { isOpen: isDeleteOpen, onOpen: onDeleteOpen, onClose: onDeleteClose } = useDisclosure();
  const toast = useToast();

  const [formData, setFormData] = useState({
    name: '',
    nameAr: '',
    startDate: '',
    endDate: '',
    type: 'national',
    description: '',
    appliesToAll: true,
    isActive: true
  });

  useEffect(() => {
    fetchHolidays();
  }, [filterYear, filterType]);

  const fetchHolidays = async () => {
    try {
      setLoading(true);
      const params = {};
      if (filterYear) params.year = filterYear;
      if (filterType) params.type = filterType;
      
      const data = await holidaysAPI.getAll(params);
      setHolidays(data.holidays || []);
    } catch (error) {
      toast({
        title: 'خطأ',
        description: 'فشل تحميل العطل',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (holiday = null) => {
    if (holiday) {
      setSelectedHoliday(holiday);
      setFormData({
        name: holiday.name,
        nameAr: holiday.nameAr || '',
        startDate: holiday.startDate.split('T')[0],
        endDate: holiday.endDate.split('T')[0],
        type: holiday.type,
        description: holiday.description || '',
        appliesToAll: holiday.appliesToAll,
        isActive: holiday.isActive
      });
    } else {
      setSelectedHoliday(null);
      setFormData({
        name: '',
        nameAr: '',
        startDate: '',
        endDate: '',
        type: 'national',
        description: '',
        appliesToAll: true,
        isActive: true
      });
    }
    onOpen();
  };

  const handleSave = async () => {
    try {
      if (!formData.name || !formData.startDate || !formData.endDate) {
        toast({
          title: 'خطأ',
          description: 'الرجاء ملء جميع الحقول المطلوبة',
          status: 'error',
          duration: 3000,
        });
        return;
      }

      if (selectedHoliday) {
        await holidaysAPI.update(selectedHoliday._id, formData);
        toast({
          title: 'تم التحديث',
          description: 'تم تحديث العطلة بنجاح',
          status: 'success',
          duration: 3000,
        });
      } else {
        await holidaysAPI.create(formData);
        toast({
          title: 'تم الإضافة',
          description: 'تم إضافة العطلة بنجاح',
          status: 'success',
          duration: 3000,
        });
      }

      onClose();
      fetchHolidays();
    } catch (error) {
      toast({
        title: 'خطأ',
        description: error.message || 'حدث خطأ أثناء الحفظ',
        status: 'error',
        duration: 3000,
      });
    }
  };

  const handleDelete = async () => {
    try {
      await holidaysAPI.delete(selectedHoliday._id);
      toast({
        title: 'تم الحذف',
        description: 'تم حذف العطلة بنجاح',
        status: 'success',
        duration: 3000,
      });
      onDeleteClose();
      fetchHolidays();
    } catch (error) {
      toast({
        title: 'خطأ',
        description: 'فشل حذف العطلة',
        status: 'error',
        duration: 3000,
      });
    }
  };

  const getTypeLabel = (type) => {
    const types = {
      national: { label: 'وطنية', color: 'red' },
      religious: { label: 'دينية', color: 'green' },
      company: { label: 'الشركة', color: 'blue' },
      custom: { label: 'أخرى', color: 'gray' }
    };
    return types[type] || types.custom;
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('ar-JO', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  return (
    <MainLayout>
      <Box w="100%" maxW="100%" overflowX="hidden" boxSizing="border-box">
        <HStack 
          justify="space-between" 
          mb={6} 
          flexWrap="wrap" 
          spacing={{ base: 2, md: 4 }}
          pl={{ base: 12, md: 0 }}
        >
          <Heading 
            size="lg"
            fontSize={{ base: "lg", md: "xl", lg: "2xl" }}
            flex={{ base: "1 1 100%", md: "0 1 auto" }}
          >
            إدارة العطل
          </Heading>
          <Button
            leftIcon={<FiPlus />}
            colorScheme="blue"
            onClick={() => handleOpenModal()}
            size={{ base: "sm", md: "md" }}
            flex={{ base: "0 0 auto", md: "0 1 auto" }}
            w={{ base: "100%", md: "auto" }}
          >
            إضافة عطلة جديدة
          </Button>
        </HStack>

        {/* Tabs for List and Calendar View */}
        <Tabs mb={6} variant="enclosed">
          <TabList 
            flexWrap="wrap"
            overflowX="auto"
            css={{
              '&::-webkit-scrollbar': {
                display: 'none'
              },
              '-ms-overflow-style': 'none',
              'scrollbar-width': 'none'
            }}
          >
            <Tab 
              fontSize={{ base: "xs", md: "sm" }}
              px={{ base: 2, md: 4 }}
              py={{ base: 2, md: 3 }}
              whiteSpace="nowrap"
            >
              <Icon as={FiList} mr={2} />
              القائمة
            </Tab>
            <Tab 
              fontSize={{ base: "xs", md: "sm" }}
              px={{ base: 2, md: 4 }}
              py={{ base: 2, md: 3 }}
              whiteSpace="nowrap"
            >
              <Icon as={FiCalendar} mr={2} />
              التقويم
            </Tab>
          </TabList>

          <TabPanels>
            <TabPanel p={0} pt={6}>
              {/* Filters and Table - existing content */}

              {/* Filters */}
              <Card mb={6}>
          <CardBody>
            <SimpleGrid columns={{ base: 1, md: 3 }} spacing={4}>
              <FormControl>
                <FormLabel>السنة</FormLabel>
                <Select
                  value={filterYear}
                  onChange={(e) => setFilterYear(e.target.value)}
                >
                  {[2024, 2025, 2026, 2027].map(year => (
                    <option key={year} value={year}>{year}</option>
                  ))}
                </Select>
              </FormControl>

              <FormControl>
                <FormLabel>النوع</FormLabel>
                <Select
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value)}
                >
                  <option value="">الكل</option>
                  <option value="national">وطنية</option>
                  <option value="religious">دينية</option>
                  <option value="company">الشركة</option>
                  <option value="custom">أخرى</option>
                </Select>
              </FormControl>

              <Button
                colorScheme="teal"
                variant="outline"
                onClick={fetchHolidays}
                alignSelf="end"
              >
                تحديث
              </Button>
            </SimpleGrid>
          </CardBody>
        </Card>

              {/* Holidays Table */}
              <Card>
          <CardBody>
            {loading ? (
              <Center py={10}>
                <Spinner size="xl" color="blue.500" />
              </Center>
            ) : holidays.length === 0 ? (
              <Center py={10}>
                <VStack spacing={4}>
                  <Icon as={FiCalendar} boxSize={16} color="gray.300" />
                  <Text color="gray.500">لا توجد عطل مسجلة</Text>
                  <Button
                    leftIcon={<FiPlus />}
                    colorScheme="blue"
                    onClick={() => handleOpenModal()}
                  >
                    إضافة عطلة الآن
                  </Button>
                </VStack>
              </Center>
            ) : (
              <TableContainer overflowX="auto" maxW="100%">
                <Table variant="simple" size={{ base: "sm", md: "md" }}>
                  <Thead>
                    <Tr>
                      <Th>الاسم</Th>
                      <Th>النوع</Th>
                      <Th>تاريخ البداية</Th>
                      <Th>تاريخ النهاية</Th>
                      <Th>الأيام</Th>
                      <Th>الحالة</Th>
                      <Th>الإجراءات</Th>
                    </Tr>
                  </Thead>
                  <Tbody>
                    {holidays.map((holiday) => {
                      const days = Math.ceil(
                        (new Date(holiday.endDate) - new Date(holiday.startDate)) / (1000 * 60 * 60 * 24)
                      ) + 1;
                      const typeInfo = getTypeLabel(holiday.type);

                      return (
                        <Tr key={holiday._id}>
                          <Td>
                            <VStack align="start" spacing={1}>
                              <Text fontWeight="bold">{holiday.nameAr || holiday.name}</Text>
                              {holiday.description && (
                                <Text fontSize="sm" color="gray.600">
                                  {holiday.description}
                                </Text>
                              )}
                            </VStack>
                          </Td>
                          <Td>
                            <Badge colorScheme={typeInfo.color}>
                              {typeInfo.label}
                            </Badge>
                          </Td>
                          <Td>{formatDate(holiday.startDate)}</Td>
                          <Td>{formatDate(holiday.endDate)}</Td>
                          <Td>
                            <Badge colorScheme="purple">{days} يوم</Badge>
                          </Td>
                          <Td>
                            <Badge colorScheme={holiday.isActive ? 'green' : 'gray'}>
                              {holiday.isActive ? 'نشط' : 'غير نشط'}
                            </Badge>
                          </Td>
                          <Td>
                            <HStack spacing={2}>
                              <IconButton
                                icon={<FiEdit2 />}
                                size="sm"
                                colorScheme="blue"
                                variant="ghost"
                                onClick={() => handleOpenModal(holiday)}
                              />
                              <IconButton
                                icon={<FiTrash2 />}
                                size="sm"
                                colorScheme="red"
                                variant="ghost"
                                onClick={() => {
                                  setSelectedHoliday(holiday);
                                  onDeleteOpen();
                                }}
                              />
                            </HStack>
                          </Td>
                        </Tr>
                      );
                    })}
                  </Tbody>
                </Table>
              </TableContainer>
            )}
          </CardBody>
        </Card>

            </TabPanel>

            <TabPanel p={0} pt={6}>
              {/* Calendar View */}
              <HolidayCalendar />
            </TabPanel>
          </TabPanels>
        </Tabs>

        {/* Add/Edit Modal */}
        <Modal isOpen={isOpen} onClose={onClose} size="xl">
          <ModalOverlay />
          <ModalContent>
            <ModalHeader>
              {selectedHoliday ? 'تعديل العطلة' : 'إضافة عطلة جديدة'}
            </ModalHeader>
            <ModalCloseButton />
            <ModalBody>
              <VStack spacing={4}>
                <FormControl isRequired>
                  <FormLabel>الاسم (بالعربي)</FormLabel>
                  <Input
                    value={formData.nameAr}
                    onChange={(e) => setFormData({ ...formData, nameAr: e.target.value })}
                    placeholder="مثال: عيد الفطر"
                  />
                </FormControl>

                <FormControl isRequired>
                  <FormLabel>الاسم (بالإنجليزي)</FormLabel>
                  <Input
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Example: Eid Al-Fitr"
                  />
                </FormControl>

                <SimpleGrid columns={2} spacing={4} width="100%">
                  <FormControl isRequired>
                    <FormLabel>تاريخ البداية</FormLabel>
                    <Input
                      type="date"
                      value={formData.startDate}
                      onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                    />
                  </FormControl>

                  <FormControl isRequired>
                    <FormLabel>تاريخ النهاية</FormLabel>
                    <Input
                      type="date"
                      value={formData.endDate}
                      onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                    />
                  </FormControl>
                </SimpleGrid>

                <FormControl>
                  <FormLabel>النوع</FormLabel>
                  <Select
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                  >
                    <option value="national">وطنية</option>
                    <option value="religious">دينية</option>
                    <option value="company">الشركة</option>
                    <option value="custom">أخرى</option>
                  </Select>
                </FormControl>

                <FormControl>
                  <FormLabel>الوصف</FormLabel>
                  <Textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="وصف اختياري للعطلة"
                  />
                </FormControl>

                <FormControl display="flex" alignItems="center">
                  <FormLabel mb="0">نشط</FormLabel>
                  <Switch
                    isChecked={formData.isActive}
                    onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                  />
                </FormControl>
              </VStack>
            </ModalBody>

            <ModalFooter>
              <Button variant="ghost" mr={3} onClick={onClose}>
                إلغاء
              </Button>
              <Button colorScheme="blue" onClick={handleSave}>
                {selectedHoliday ? 'تحديث' : 'إضافة'}
              </Button>
            </ModalFooter>
          </ModalContent>
        </Modal>

        {/* Delete Confirmation Modal */}
        <Modal isOpen={isDeleteOpen} onClose={onDeleteClose}>
          <ModalOverlay />
          <ModalContent>
            <ModalHeader>تأكيد الحذف</ModalHeader>
            <ModalCloseButton />
            <ModalBody>
              <Text>
                هل أنت متأكد من حذف العطلة "{selectedHoliday?.nameAr || selectedHoliday?.name}"؟
              </Text>
              <Text mt={2} color="red.500" fontSize="sm">
                سيتم إزالة حالة العطلة من جميع سجلات الحضور المرتبطة بها.
              </Text>
            </ModalBody>

            <ModalFooter>
              <Button variant="ghost" mr={3} onClick={onDeleteClose}>
                إلغاء
              </Button>
              <Button colorScheme="red" onClick={handleDelete}>
                حذف
              </Button>
            </ModalFooter>
          </ModalContent>
        </Modal>
      </Box>
    </MainLayout>
  );
};

export default Holidays;
